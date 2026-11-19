import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { addDays, format, differenceInCalendarDays } from "date-fns";

export const APP_TIMEZONE = "Europe/Paris";

export function toAppTime(date: Date): Date {
  return toZonedTime(date, APP_TIMEZONE);
}

export function fromAppTime(date: Date): Date {
  return fromZonedTime(date, APP_TIMEZONE);
}

export const INVALID_SHIFT_TIME_MESSAGE = "L'heure de fin doit être postérieure à l'heure de début.";

export function isOvernightTime(start: string, end: string): boolean {
  return start > "17:00" && end < "05:00" && end < start;
}

export function isValidShiftTimes(start: string, end: string): boolean {
  return end > start || isOvernightTime(start, end);
}

export function shiftDatesForDay(day: string, start: string, end: string): { startTime: Date; endTime: Date } {
  if (!isValidShiftTimes(start, end)) throw new Error(INVALID_SHIFT_TIME_MESSAGE);
  const endDay = isOvernightTime(start, end)
    ? format(addDays(new Date(`${day}T12:00:00`), 1), "yyyy-MM-dd")
    : day;
  return {
    startTime: fromZonedTime(`${day}T${start}:00`, APP_TIMEZONE),
    endTime: fromZonedTime(`${endDay}T${end}:00`, APP_TIMEZONE),
  };
}

export function isValidShiftInterval(start: Date, end: Date): boolean {
  if (end <= start) return false;
  const localStart = toAppTime(start);
  const localEnd = toAppTime(end);
  const days = differenceInCalendarDays(localEnd, localStart);
  if (days === 0) return true;
  return days === 1 && isOvernightTime(format(localStart, "HH:mm"), format(localEnd, "HH:mm"));
}
