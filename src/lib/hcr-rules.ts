/**
 * Moteur de règles HCR
 * Règles légales obligatoires (repos quotidien 11h, plafond hebdomadaire 48h, 2 jours de repos hebdo, délai de prévenance 8 jours, arrondi de pointage)
 */

import {
  differenceInCalendarDays,
  differenceInMilliseconds,
  startOfWeek,
  endOfWeek,
  format,
  eachDayOfInterval,
  max as dateMax,
  min as dateMin,
} from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { APP_TIMEZONE } from "./time-utils";

export const HCR_RULES = {
  MIN_DAILY_REST_HOURS: 11,
  MAX_WEEKLY_HOURS: 48,
  MIN_WEEKLY_REST_DAYS: 2,
  MAX_CONSECUTIVE_WORKED_DAYS: 5,
  DEFAULT_NOTICE_PERIOD_DAYS: 8,
  DEFAULT_ROUNDING_MINUTES: 15,
} as const;

export interface ShiftTimeInterval {
  id?: string;
  startTime: Date;
  endTime: Date;
}

export type RoundingMode = "nearest" | "floor" | "ceil";

export interface NoticePeriodResult {
  isCompliant: boolean;
  daysDifference: number;
  requiresDerogation: boolean;
}

export interface WeeklyHoursResult {
  isValid: boolean;
  totalHours: number;
  remainingHours: number;
}

export interface WeeklyRestDaysResult {
  isValid: boolean;
  workedDaysCount: number;
  restDaysCount: number;
}

export interface ConsecutiveDaysResult {
  isValid: boolean;
  maxConsecutiveFound: number;
}

export interface ShiftSwapValidationResult {
  isEligible: boolean;
  errors: string[];
}

/**
 * 1. Repos quotidien (11h)
 * Vérifie que l'écart entre la fin du shift précédent et le début du shift suivant est >= 11h.
 */
export function checkDailyRest(
  previousShiftEnd: Date,
  nextShiftStart: Date,
  minHours: number = HCR_RULES.MIN_DAILY_REST_HOURS
): boolean {
  const diffInMs = differenceInMilliseconds(nextShiftStart, previousShiftEnd);
  const diffInHours = diffInMs / (1000 * 60 * 60);
  return diffInHours >= minHours;
}

/**
 * Vérifie le repos quotidien sur une liste de shifts.
 * Trie les shifts par heure de début et vérifie chaque intervalle consécutif.
 */
export function validateConsecutiveShiftsDailyRest(
  shifts: ShiftTimeInterval[],
  minHours: number = HCR_RULES.MIN_DAILY_REST_HOURS
): { isValid: boolean; violationIndex?: number } {
  if (shifts.length <= 1) {
    return { isValid: true };
  }

  const sortedShifts = [...shifts].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime()
  );

  for (let i = 0; i < sortedShifts.length - 1; i++) {
    const currentShift = sortedShifts[i];
    const nextShift = sortedShifts[i + 1];

    if (!checkDailyRest(currentShift.endTime, nextShift.startTime, minHours)) {
      return { isValid: false, violationIndex: i };
    }
  }

  return { isValid: true };
}

/**
 * Calcule les bornes d'une semaine civile (du lundi 00h00 au dimanche 23h59:59.999) dans un fuseau donné.
 */
function getCivilWeekBounds(targetDate: Date, timeZone: string = APP_TIMEZONE) {
  // Convert targetDate to the target timezone
  const zonedDate = toZonedTime(targetDate, timeZone);

  // Semaine civile : lundi (weekStartsOn: 1) à dimanche
  const startOfZonedWeek = startOfWeek(zonedDate, { weekStartsOn: 1 });
  const endOfZonedWeek = endOfWeek(zonedDate, { weekStartsOn: 1 });

  // Convert back to absolute UTC Dates
  const utcStart = fromZonedTime(startOfZonedWeek, timeZone);
  const utcEnd = fromZonedTime(endOfZonedWeek, timeZone);

  return { start: utcStart, end: utcEnd };
}

/**
 * 2. Plafond hebdomadaire (48h)
 * Calcule le cumul d'heures sur la semaine civile (lundi 00:00 au dimanche 23:59 dans le fuseau spécifié).
 * Gère avec exactitude les shifts chevauchant deux semaines civiles.
 */
export function calculateWeeklyHours(
  shifts: ShiftTimeInterval[],
  targetDate: Date,
  timeZone: string = APP_TIMEZONE
): number {
  const { start: weekStart, end: weekEnd } = getCivilWeekBounds(
    targetDate,
    timeZone
  );

  let totalMs = 0;

  for (const shift of shifts) {
    // Calcul de l'intersection entre le créneau du shift et la semaine civile
    const effectiveStart = dateMax([shift.startTime, weekStart]);
    const effectiveEnd = dateMin([shift.endTime, weekEnd]);

    if (effectiveStart < effectiveEnd) {
      totalMs += differenceInMilliseconds(effectiveEnd, effectiveStart);
    }
  }

  return Number((totalMs / (1000 * 60 * 60)).toFixed(2));
}

/**
 * Valide que l'ajout d'un shift projeté ne fait pas dépasser les 48h sur aucune semaine civile couverte.
 */
export function validateWeeklyHours(
  existingShifts: ShiftTimeInterval[],
  projectedShift: ShiftTimeInterval,
  maxHours: number = HCR_RULES.MAX_WEEKLY_HOURS,
  timeZone: string = APP_TIMEZONE
): WeeklyHoursResult {
  const allShifts = [...existingShifts, projectedShift];

  // Le shift projeté peut chevaucher le début de semaine et la fin de semaine
  const datesToCheck = [projectedShift.startTime, projectedShift.endTime];
  let maxFoundHours = 0;

  for (const date of datesToCheck) {
    const weeklyHours = calculateWeeklyHours(allShifts, date, timeZone);
    if (weeklyHours > maxFoundHours) {
      maxFoundHours = weeklyHours;
    }
  }

  const remaining = Number(Math.max(0, maxHours - maxFoundHours).toFixed(2));

  return {
    isValid: maxFoundHours <= maxHours,
    totalHours: maxFoundHours,
    remainingHours: remaining,
  };
}

/**
 * Extrait l'ensemble des dates calendaires (YYYY-MM-DD) touchées par un ensemble de shifts dans le fuseau horaire.
 */
function getWorkedCalendarDays(
  shifts: ShiftTimeInterval[],
  timeZone: string = APP_TIMEZONE
): Set<string> {
  const workedDays = new Set<string>();

  for (const shift of shifts) {
    const zonedStart = toZonedTime(shift.startTime, timeZone);
    const zonedEnd = toZonedTime(shift.endTime, timeZone);

    // Liste des jours calendaires traversés par le shift
    const daysInterval = eachDayOfInterval({
      start: zonedStart,
      end: zonedEnd,
    });

    for (const d of daysInterval) {
      // Si la fin du shift tombe pile à minuit (ex: 20:00 - 00:00), le jour suivant n'a pas été travaillé
      if (
        d.getTime() === daysInterval[daysInterval.length - 1].getTime() &&
        daysInterval.length > 1 &&
        zonedEnd.getHours() === 0 &&
        zonedEnd.getMinutes() === 0 &&
        zonedEnd.getSeconds() === 0 &&
        zonedEnd.getMilliseconds() === 0
      ) {
        continue;
      }
      workedDays.add(format(d, "yyyy-MM-dd"));
    }
  }

  return workedDays;
}

/**
 * 3. Repos hebdomadaire (2 jours / semaine civile)
 * Décompte les jours travaillés sur la semaine civile lundi-dimanche.
 * Valide si le nombre de jours travaillés est <= 5 (donc >= 2 jours de repos).
 */
export function validateWeeklyRestDays(
  shifts: ShiftTimeInterval[],
  weekDate: Date,
  timeZone: string = APP_TIMEZONE
): WeeklyRestDaysResult {
  const zonedDate = toZonedTime(weekDate, timeZone);
  const startOfZonedWeek = startOfWeek(zonedDate, { weekStartsOn: 1 });
  const endOfZonedWeek = endOfWeek(zonedDate, { weekStartsOn: 1 });

  const weekDays = eachDayOfInterval({
    start: startOfZonedWeek,
    end: endOfZonedWeek,
  });

  const workedCalendarDays = getWorkedCalendarDays(shifts, timeZone);

  let workedDaysCount = 0;
  for (const day of weekDays) {
    const dayStr = format(day, "yyyy-MM-dd");
    if (workedCalendarDays.has(dayStr)) {
      workedDaysCount++;
    }
  }

  const restDaysCount = Math.max(0, 7 - workedDaysCount);
  const isValid = restDaysCount >= HCR_RULES.MIN_WEEKLY_REST_DAYS;

  return {
    isValid,
    workedDaysCount,
    restDaysCount,
  };
}

/**
 * Vérifie le nombre maximal de jours consécutifs travaillés.
 * Interdiction de planifier plus de 5 jours consécutifs de travail (même à cheval sur deux semaines).
 */
export function validateMaxConsecutiveWorkedDays(
  shifts: ShiftTimeInterval[],
  maxConsecutiveDays: number = HCR_RULES.MAX_CONSECUTIVE_WORKED_DAYS,
  timeZone: string = APP_TIMEZONE
): ConsecutiveDaysResult {
  if (shifts.length === 0) {
    return { isValid: true, maxConsecutiveFound: 0 };
  }

  const workedDaysSet = getWorkedCalendarDays(shifts, timeZone);
  const sortedDates = Array.from(workedDaysSet).sort();

  if (sortedDates.length === 0) {
    return { isValid: true, maxConsecutiveFound: 0 };
  }

  let maxConsecutive = 1;
  let currentConsecutive = 1;

  for (let i = 0; i < sortedDates.length - 1; i++) {
    const currentDate = new Date(sortedDates[i]);
    const nextDate = new Date(sortedDates[i + 1]);

    const diffDays = differenceInCalendarDays(nextDate, currentDate);

    if (diffDays === 1) {
      currentConsecutive++;
      if (currentConsecutive > maxConsecutive) {
        maxConsecutive = currentConsecutive;
      }
    } else {
      currentConsecutive = 1;
    }
  }

  return {
    isValid: maxConsecutive <= maxConsecutiveDays,
    maxConsecutiveFound: maxConsecutive,
  };
}

/**
 * 4. Délai de prévenance (8 jours calendaires par défaut)
 * Détecte si l'attribution/modification intervient à moins de 8 jours par rapport à la date de référence.
 * Si différence < 8 jours => déclenche obligatoirement requiresDerogation: true (statut EN_ATTENTE_DEROGATION).
 */
export function checkNoticePeriod(
  shiftStartTime: Date,
  referenceDate: Date = new Date(),
  noticeDelayDays: number = HCR_RULES.DEFAULT_NOTICE_PERIOD_DAYS,
  timeZone: string = APP_TIMEZONE
): NoticePeriodResult {
  const zonedShift = toZonedTime(shiftStartTime, timeZone);
  const zonedRef = toZonedTime(referenceDate, timeZone);

  const daysDifference = differenceInCalendarDays(zonedShift, zonedRef);
  const isCompliant = daysDifference >= noticeDelayDays;

  return {
    isCompliant,
    daysDifference,
    requiresDerogation: !isCompliant,
  };
}

/**
 * 5. Règle d'arrondi au quart d'heure (15 min)
 * Arrondi automatique standardisé sur le pointage brut de sortie.
 * Exemples en mode "nearest" (15 min) :
 *  - 17h07 -> 17h00 (7 <= 7.5 min)
 *  - 17h08 -> 17h15 (8 > 7.5 min)
 */
export function roundClockOutTime(
  rawClockOut: Date,
  intervalMinutes: number = HCR_RULES.DEFAULT_ROUNDING_MINUTES,
  mode: RoundingMode = "nearest"
): Date {
  const intervalMs = intervalMinutes * 60 * 1000;
  const time = rawClockOut.getTime();

  let roundedTime: number;

  switch (mode) {
    case "floor":
      roundedTime = Math.floor(time / intervalMs) * intervalMs;
      break;
    case "ceil":
      roundedTime = Math.ceil(time / intervalMs) * intervalMs;
      break;
    case "nearest":
    default:
      roundedTime = Math.round(time / intervalMs) * intervalMs;
      break;
  }

  return new Date(roundedTime);
}

/**
 * 6. Validation d'un échange de shift (ShiftSwap)
 * Certifie qu'un salarié repreneur est légalement éligible à reprendre un shift sans enfreindre :
 *  - Le repos quotidien de 11h (par rapport à ses shifts existants avant et après)
 *  - Le plafond hebdomadaire de 48h
 *  - Le repos hebdomadaire de 2 jours (max 5 jours consécutifs travaillés)
 */
export function validateShiftSwapEligibility(
  targetUserExistingShifts: ShiftTimeInterval[],
  shiftToTake: ShiftTimeInterval,
  options?: {
    maxWeeklyHours?: number;
    minDailyRestHours?: number;
    timeZone?: string;
  }
): ShiftSwapValidationResult {
  const maxWeeklyHours = options?.maxWeeklyHours ?? HCR_RULES.MAX_WEEKLY_HOURS;
  const minDailyRestHours =
    options?.minDailyRestHours ?? HCR_RULES.MIN_DAILY_REST_HOURS;
  const timeZone = options?.timeZone ?? APP_TIMEZONE;

  const errors: string[] = [];

  // Vérifier d'abord s'il y a chevauchement direct avec un shift existant
  const hasOverlap = targetUserExistingShifts.some(
    (existing) =>
      shiftToTake.startTime < existing.endTime &&
      shiftToTake.endTime > existing.startTime
  );

  if (hasOverlap) {
    errors.push("Le créneau chevauche un shift déjà existant du salarié.");
  }

  // 1. Repos quotidien (11h)
  const combinedShifts = [...targetUserExistingShifts, shiftToTake];
  const restValidation = validateConsecutiveShiftsDailyRest(
    combinedShifts,
    minDailyRestHours
  );
  if (!restValidation.isValid) {
    errors.push(
      `Non-respect du repos quotidien légal (${minDailyRestHours}h consécutives obligatoires).`
    );
  }

  // 2. Plafond hebdomadaire (48h)
  const weeklyHoursValidation = validateWeeklyHours(
    targetUserExistingShifts,
    shiftToTake,
    maxWeeklyHours,
    timeZone
  );
  if (!weeklyHoursValidation.isValid) {
    errors.push(
      `Dépassement du plafond hebdomadaire de ${maxWeeklyHours}h (cumul projeté : ${weeklyHoursValidation.totalHours}h).`
    );
  }

  // 3. Repos hebdomadaire (2 jours / max 5 jours consécutifs)
  const weeklyRestValidation = validateWeeklyRestDays(
    combinedShifts,
    shiftToTake.startTime,
    timeZone
  );
  if (!weeklyRestValidation.isValid) {
    errors.push(
      `Non-respect du repos hebdomadaire (minimum ${HCR_RULES.MIN_WEEKLY_REST_DAYS} jours de repos requis par semaine civile, actuellement ${weeklyRestValidation.restDaysCount} jours).`
    );
  }

  const consecutiveDaysValidation = validateMaxConsecutiveWorkedDays(
    combinedShifts,
    HCR_RULES.MAX_CONSECUTIVE_WORKED_DAYS,
    timeZone
  );
  if (!consecutiveDaysValidation.isValid) {
    errors.push(
      `Dépassement du maximum légal de ${HCR_RULES.MAX_CONSECUTIVE_WORKED_DAYS} jours consécutifs de travail (${consecutiveDaysValidation.maxConsecutiveFound} jours consécutifs).`
    );
  }

  return {
    isEligible: errors.length === 0,
    errors,
  };
}
