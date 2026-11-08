import { describe, it, expect } from "vitest";
import {
  checkDailyRest,
  validateConsecutiveShiftsDailyRest,
  calculateWeeklyHours,
  validateWeeklyHours,
  validateWeeklyRestDays,
  validateMaxConsecutiveWorkedDays,
  checkNoticePeriod,
  roundClockOutTime,
  validateShiftSwapEligibility,
} from "@/lib/hcr-rules";

describe("Moteur de règles HCR - src/lib/hcr-rules.ts", () => {
  describe("1. Repos quotidien (11h consécutives)", () => {
    it("valide exactement 11h de repos consécutives", () => {
      const end = new Date("2025-01-01T22:00:00Z");
      const nextStart = new Date("2025-01-02T09:00:00Z");
      expect(checkDailyRest(end, nextStart)).toBe(true);
    });

    it("valide 11h01 de repos consécutives", () => {
      const end = new Date("2025-01-01T22:00:00Z");
      const nextStart = new Date("2025-01-02T09:01:00Z");
      expect(checkDailyRest(end, nextStart)).toBe(true);
    });

    it("invalide 10h59 de repos (inférieur à 11h)", () => {
      const end = new Date("2025-01-01T22:00:00Z");
      const nextStart = new Date("2025-01-02T08:59:00Z");
      expect(checkDailyRest(end, nextStart)).toBe(false);
    });

    it("invalide un repos insuffisant après service de nuit (ex: fin 02:00, reprise 10:00 = 8h)", () => {
      const end = new Date("2025-01-02T02:00:00Z");
      const nextStart = new Date("2025-01-02T10:00:00Z");
      expect(checkDailyRest(end, nextStart)).toBe(false);
    });

    it("détecte une coupure en journée de moins de 11h consécutives entre deux shifts", () => {
      // Shift 1: 10:00 - 14:00 (coupure l'après-midi de 4h)
      // Shift 2: 18:00 - 23:00
      // Shift 3: 11:00 - 15:00 (repos nuit jusqu'au lendemain = 12h)
      const shifts = [
        {
          startTime: new Date("2025-01-01T10:00:00Z"),
          endTime: new Date("2025-01-01T14:00:00Z"),
        },
        {
          startTime: new Date("2025-01-01T18:00:00Z"),
          endTime: new Date("2025-01-01T23:00:00Z"),
        },
        {
          startTime: new Date("2025-01-02T11:00:00Z"),
          endTime: new Date("2025-01-02T15:00:00Z"),
        },
      ];

      const result = validateConsecutiveShiftsDailyRest(shifts);
      expect(result.isValid).toBe(false);
      expect(result.violationIndex).toBe(0); // Violation entre 14:00 et 18:00 (4h < 11h)
    });

    it("valide validateConsecutiveShiftsDailyRest sur des shifts avec >= 11h entre chacun", () => {
      const shifts = [
        {
          startTime: new Date("2025-01-01T08:00:00Z"),
          endTime: new Date("2025-01-01T16:00:00Z"),
        },
        {
          startTime: new Date("2025-01-02T08:00:00Z"),
          endTime: new Date("2025-01-02T16:00:00Z"),
        },
      ];
      expect(validateConsecutiveShiftsDailyRest(shifts).isValid).toBe(true);
    });
  });

  describe("2. Plafond hebdomadaire (48h max sur semaine civile)", () => {
    // Semaine civile du lundi 6 janvier 2025 au dimanche 12 janvier 2025
    it("calcule avec exactitude les heures cumulées sur la semaine civile", () => {
      const shifts = [
        {
          // Lundi 6 janvier: 8h
          startTime: new Date("2025-01-06T08:00:00+01:00"),
          endTime: new Date("2025-01-06T16:00:00+01:00"),
        },
        {
          // Mardi 7 janvier: 8h
          startTime: new Date("2025-01-07T08:00:00+01:00"),
          endTime: new Date("2025-01-07T16:00:00+01:00"),
        },
        {
          // Mercredi 8 janvier: 8h
          startTime: new Date("2025-01-08T08:00:00+01:00"),
          endTime: new Date("2025-01-08T16:00:00+01:00"),
        },
      ];
      const targetDate = new Date("2025-01-08T10:00:00+01:00");
      expect(calculateWeeklyHours(shifts, targetDate)).toBe(24);
    });

    it("valide un cumul de 48h00 pile", () => {
      // 6 jours de 8h = 48h
      const existingShifts = [
        {
          startTime: new Date("2025-01-06T08:00:00+01:00"),
          endTime: new Date("2025-01-06T16:00:00+01:00"),
        },
        {
          startTime: new Date("2025-01-07T08:00:00+01:00"),
          endTime: new Date("2025-01-07T16:00:00+01:00"),
        },
        {
          startTime: new Date("2025-01-08T08:00:00+01:00"),
          endTime: new Date("2025-01-08T16:00:00+01:00"),
        },
        {
          startTime: new Date("2025-01-09T08:00:00+01:00"),
          endTime: new Date("2025-01-09T16:00:00+01:00"),
        },
        {
          startTime: new Date("2025-01-10T08:00:00+01:00"),
          endTime: new Date("2025-01-10T16:00:00+01:00"),
        },
      ]; // 40h
      const projectedShift = {
        startTime: new Date("2025-01-11T08:00:00+01:00"),
        endTime: new Date("2025-01-11T16:00:00+01:00"),
      }; // +8h = 48h

      const res = validateWeeklyHours(existingShifts, projectedShift);
      expect(res.isValid).toBe(true);
      expect(res.totalHours).toBe(48);
      expect(res.remainingHours).toBe(0);
    });

    it("rejette un dépassement à 48h30", () => {
      const existingShifts = [
        {
          startTime: new Date("2025-01-06T08:00:00+01:00"),
          endTime: new Date("2025-01-06T16:00:00+01:00"),
        },
        {
          startTime: new Date("2025-01-07T08:00:00+01:00"),
          endTime: new Date("2025-01-07T16:00:00+01:00"),
        },
        {
          startTime: new Date("2025-01-08T08:00:00+01:00"),
          endTime: new Date("2025-01-08T16:00:00+01:00"),
        },
        {
          startTime: new Date("2025-01-09T08:00:00+01:00"),
          endTime: new Date("2025-01-09T16:00:00+01:00"),
        },
        {
          startTime: new Date("2025-01-10T08:00:00+01:00"),
          endTime: new Date("2025-01-10T16:00:00+01:00"),
        },
      ]; // 40h
      const projectedShift = {
        startTime: new Date("2025-01-11T08:00:00+01:00"),
        endTime: new Date("2025-01-11T16:30:00+01:00"),
      }; // +8.5h = 48.5h

      const res = validateWeeklyHours(existingShifts, projectedShift);
      expect(res.isValid).toBe(false);
      expect(res.totalHours).toBe(48.5);
    });

    it("répartit correctement les heures d'un shift à cheval sur dimanche et lundi (deux semaines)", () => {
      // Nuit du dimanche 12 janvier au lundi 13 janvier 2025 : 20h00 à 04h00 (8h au total)
      // Dimanche 20:00 -> 00:00 = 4h sur Semaine 1
      // Lundi 00:00 -> 04:00 = 4h sur Semaine 2
      const shiftCrossWeek = {
        startTime: new Date("2025-01-12T20:00:00+01:00"),
        endTime: new Date("2025-01-13T04:00:00+01:00"),
      };

      const week1Date = new Date("2025-01-12T10:00:00+01:00");
      const week2Date = new Date("2025-01-13T10:00:00+01:00");

      const hoursWeek1 = calculateWeeklyHours([shiftCrossWeek], week1Date);
      const hoursWeek2 = calculateWeeklyHours([shiftCrossWeek], week2Date);

      expect(hoursWeek1).toBe(4);
      expect(hoursWeek2).toBe(4);
    });
  });

  describe("3. Repos hebdomadaire (2 jours / semaine & max 5 jours consécutifs)", () => {
    it("valide une semaine de 5 jours travaillés (2 jours de repos)", () => {
      // Lun, Mar, Mer, Jeu, Ven travaillés
      const shifts = [
        {
          startTime: new Date("2025-01-06T09:00:00+01:00"),
          endTime: new Date("2025-01-06T17:00:00+01:00"),
        },
        {
          startTime: new Date("2025-01-07T09:00:00+01:00"),
          endTime: new Date("2025-01-07T17:00:00+01:00"),
        },
        {
          startTime: new Date("2025-01-08T09:00:00+01:00"),
          endTime: new Date("2025-01-08T17:00:00+01:00"),
        },
        {
          startTime: new Date("2025-01-09T09:00:00+01:00"),
          endTime: new Date("2025-01-09T17:00:00+01:00"),
        },
        {
          startTime: new Date("2025-01-10T09:00:00+01:00"),
          endTime: new Date("2025-01-10T17:00:00+01:00"),
        },
      ];

      const res = validateWeeklyRestDays(shifts, new Date("2025-01-07T10:00:00+01:00"));
      expect(res.isValid).toBe(true);
      expect(res.workedDaysCount).toBe(5);
      expect(res.restDaysCount).toBe(2);
    });

    it("invalide une semaine de 6 jours travaillés (1 seul jour de repos)", () => {
      const shifts = [
        { startTime: new Date("2025-01-06T09:00:00+01:00"), endTime: new Date("2025-01-06T17:00:00+01:00") },
        { startTime: new Date("2025-01-07T09:00:00+01:00"), endTime: new Date("2025-01-07T17:00:00+01:00") },
        { startTime: new Date("2025-01-08T09:00:00+01:00"), endTime: new Date("2025-01-08T17:00:00+01:00") },
        { startTime: new Date("2025-01-09T09:00:00+01:00"), endTime: new Date("2025-01-09T17:00:00+01:00") },
        { startTime: new Date("2025-01-10T09:00:00+01:00"), endTime: new Date("2025-01-10T17:00:00+01:00") },
        { startTime: new Date("2025-01-11T09:00:00+01:00"), endTime: new Date("2025-01-11T17:00:00+01:00") },
      ];

      const res = validateWeeklyRestDays(shifts, new Date("2025-01-07T10:00:00+01:00"));
      expect(res.isValid).toBe(false);
      expect(res.workedDaysCount).toBe(6);
      expect(res.restDaysCount).toBe(1);
    });

    it("détecte et rejette plus de 5 jours consécutifs travaillés à cheval sur deux semaines", () => {
      // Mercredi 8, Jeudi 9, Vendredi 10, Samedi 11, Dimanche 12 (semaine 1 = 5 jours)
      // Lundi 13 janvier (semaine 2 = 6ème jour consécutif)
      const shifts = [
        { startTime: new Date("2025-01-08T09:00:00+01:00"), endTime: new Date("2025-01-08T17:00:00+01:00") },
        { startTime: new Date("2025-01-09T09:00:00+01:00"), endTime: new Date("2025-01-09T17:00:00+01:00") },
        { startTime: new Date("2025-01-10T09:00:00+01:00"), endTime: new Date("2025-01-10T17:00:00+01:00") },
        { startTime: new Date("2025-01-11T09:00:00+01:00"), endTime: new Date("2025-01-11T17:00:00+01:00") },
        { startTime: new Date("2025-01-12T09:00:00+01:00"), endTime: new Date("2025-01-12T17:00:00+01:00") },
        { startTime: new Date("2025-01-13T09:00:00+01:00"), endTime: new Date("2025-01-13T17:00:00+01:00") },
      ];

      const res = validateMaxConsecutiveWorkedDays(shifts);
      expect(res.isValid).toBe(false);
      expect(res.maxConsecutiveFound).toBe(6);
    });
  });

  describe("4. Délai de prévenance (8 jours calendaires)", () => {
    const referenceDate = new Date("2025-01-01T10:00:00+01:00");

    it("valide un shift attribué 8 jours à l'avance (conforme sans dérogation)", () => {
      const shiftStartTime = new Date("2025-01-09T08:00:00+01:00"); // J+8
      const res = checkNoticePeriod(shiftStartTime, referenceDate);
      expect(res.isCompliant).toBe(true);
      expect(res.requiresDerogation).toBe(false);
      expect(res.daysDifference).toBe(8);
    });

    it("valide un shift attribué 10 jours à l'avance", () => {
      const shiftStartTime = new Date("2025-01-11T08:00:00+01:00"); // J+10
      const res = checkNoticePeriod(shiftStartTime, referenceDate);
      expect(res.isCompliant).toBe(true);
      expect(res.requiresDerogation).toBe(false);
      expect(res.daysDifference).toBe(10);
    });

    it("invalide un shift attribué 7 jours à l'avance (déclenche dérogation)", () => {
      const shiftStartTime = new Date("2025-01-08T08:00:00+01:00"); // J+7
      const res = checkNoticePeriod(shiftStartTime, referenceDate);
      expect(res.isCompliant).toBe(false);
      expect(res.requiresDerogation).toBe(true);
      expect(res.daysDifference).toBe(7);
    });

    it("invalide un shift attribué le jour même (J+0)", () => {
      const shiftStartTime = new Date("2025-01-01T18:00:00+01:00"); // J+0
      const res = checkNoticePeriod(shiftStartTime, referenceDate);
      expect(res.isCompliant).toBe(false);
      expect(res.requiresDerogation).toBe(true);
      expect(res.daysDifference).toBe(0);
    });
  });

  describe("5. Règle d'arrondi au quart d'heure (15 min)", () => {
    it("arrondit au quart d'heure le plus proche (nearest 15m) : 17:07 -> 17:00", () => {
      const raw = new Date("2025-01-01T17:07:00Z");
      const rounded = roundClockOutTime(raw, 15, "nearest");
      expect(rounded.toISOString()).toBe(new Date("2025-01-01T17:00:00Z").toISOString());
    });

    it("arrondit au quart d'heure le plus proche (nearest 15m) : 17:08 -> 17:15", () => {
      const raw = new Date("2025-01-01T17:08:00Z");
      const rounded = roundClockOutTime(raw, 15, "nearest");
      expect(rounded.toISOString()).toBe(new Date("2025-01-01T17:15:00Z").toISOString());
    });

    it("préserve un pointage déjà calé sur le quart d'heure : 17:15 -> 17:15", () => {
      const raw = new Date("2025-01-01T17:15:00Z");
      const rounded = roundClockOutTime(raw, 15, "nearest");
      expect(rounded.toISOString()).toBe(new Date("2025-01-01T17:15:00Z").toISOString());
    });

    it("prend en compte le mode floor : 17:14 -> 17:00", () => {
      const raw = new Date("2025-01-01T17:14:00Z");
      const rounded = roundClockOutTime(raw, 15, "floor");
      expect(rounded.toISOString()).toBe(new Date("2025-01-01T17:00:00Z").toISOString());
    });

    it("prend en compte le mode ceil : 17:01 -> 17:15", () => {
      const raw = new Date("2025-01-01T17:01:00Z");
      const rounded = roundClockOutTime(raw, 15, "ceil");
      expect(rounded.toISOString()).toBe(new Date("2025-01-01T17:15:00Z").toISOString());
    });
  });

  describe("6. Validation d'un échange de shift (ShiftSwap)", () => {
    const existingShifts = [
      {
        startTime: new Date("2025-01-06T08:00:00+01:00"),
        endTime: new Date("2025-01-06T15:00:00+01:00"),
      },
      {
        startTime: new Date("2025-01-07T08:00:00+01:00"),
        endTime: new Date("2025-01-07T15:00:00+01:00"),
      },
    ];

    it("valide la reprise de shift par un salarié parfaitement éligible", () => {
      const shiftToTake = {
        startTime: new Date("2025-01-08T08:00:00+01:00"),
        endTime: new Date("2025-01-08T15:00:00+01:00"),
      };

      const res = validateShiftSwapEligibility(existingShifts, shiftToTake);
      expect(res.isEligible).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it("refuse si le shift à reprendre chevauche un shift existant du repreneur", () => {
      const shiftToTake = {
        startTime: new Date("2025-01-07T12:00:00+01:00"),
        endTime: new Date("2025-01-07T18:00:00+01:00"),
      };

      const res = validateShiftSwapEligibility(existingShifts, shiftToTake);
      expect(res.isEligible).toBe(false);
      expect(res.errors.some((e) => e.includes("chevauche"))).toBe(true);
    });

    it("refuse si la reprise de shift brise le repos quotidien de 11h", () => {
      // Repreneur a fini à 15h00 le 07/01, le nouveau shift commence à 22h00 le 07/01 (7h de repos < 11h)
      const shiftToTake = {
        startTime: new Date("2025-01-07T22:00:00+01:00"),
        endTime: new Date("2025-01-08T04:00:00+01:00"),
      };

      const res = validateShiftSwapEligibility(existingShifts, shiftToTake);
      expect(res.isEligible).toBe(false);
      expect(res.errors.some((e) => e.includes("repos quotidien"))).toBe(true);
    });

    it("refuse si la reprise de shift fait dépasser le plafond de 48h hebdomadaires", () => {
      // Salarié a déjà 45h de travail planifié dans la semaine
      const heavyShifts = [
        { startTime: new Date("2025-01-06T08:00:00+01:00"), endTime: new Date("2025-01-06T18:00:00+01:00") }, // 10h
        { startTime: new Date("2025-01-07T08:00:00+01:00"), endTime: new Date("2025-01-07T18:00:00+01:00") }, // 10h
        { startTime: new Date("2025-01-08T08:00:00+01:00"), endTime: new Date("2025-01-08T18:00:00+01:00") }, // 10h
        { startTime: new Date("2025-01-09T08:00:00+01:00"), endTime: new Date("2025-01-09T18:00:00+01:00") }, // 10h
      ]; // 40h

      // Shift proposé : 10h => 50h > 48h
      const shiftToTake = {
        startTime: new Date("2025-01-10T08:00:00+01:00"),
        endTime: new Date("2025-01-10T18:00:00+01:00"),
      };

      const res = validateShiftSwapEligibility(heavyShifts, shiftToTake);
      expect(res.isEligible).toBe(false);
      expect(res.errors.some((e) => e.includes("plafond hebdomadaire"))).toBe(true);
    });

    it("refuse si la reprise de shift entraîne plus de 5 jours travaillés sur la semaine", () => {
      // 5 jours déjà travaillés (Lundi à Vendredi)
      const fiveDaysShifts = [
        { startTime: new Date("2025-01-06T09:00:00+01:00"), endTime: new Date("2025-01-06T14:00:00+01:00") },
        { startTime: new Date("2025-01-07T09:00:00+01:00"), endTime: new Date("2025-01-07T14:00:00+01:00") },
        { startTime: new Date("2025-01-08T09:00:00+01:00"), endTime: new Date("2025-01-08T14:00:00+01:00") },
        { startTime: new Date("2025-01-09T09:00:00+01:00"), endTime: new Date("2025-01-09T14:00:00+01:00") },
        { startTime: new Date("2025-01-10T09:00:00+01:00"), endTime: new Date("2025-01-10T14:00:00+01:00") },
      ];

      // Nouveau shift proposé le Samedi => 6 jours travaillés => seulement 1 jour de repos
      const shiftToTake = {
        startTime: new Date("2025-01-11T09:00:00+01:00"),
        endTime: new Date("2025-01-11T14:00:00+01:00"),
      };

      const res = validateShiftSwapEligibility(fiveDaysShifts, shiftToTake);
      expect(res.isEligible).toBe(false);
      expect(res.errors.some((e) => e.includes("repos hebdomadaire"))).toBe(true);
    });
  });
});
