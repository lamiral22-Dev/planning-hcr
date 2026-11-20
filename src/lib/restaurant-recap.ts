import { addDays, startOfMonth, startOfWeek } from "date-fns";
import { fromAppTime, toAppTime } from "@/lib/time-utils";
import type { ShiftTimeInterval } from "@/lib/hcr-rules";

function hoursWithin(shifts: ShiftTimeInterval[], start: Date, end: Date): number {
  const milliseconds = shifts.reduce((total, shift) => {
    const overlap = Math.min(shift.endTime.getTime(), end.getTime()) -
      Math.max(shift.startTime.getTime(), start.getTime());
    return total + Math.max(0, overlap);
  }, 0);
  return milliseconds / 3_600_000;
}

/**
 * Le cumul mensuel concerne le mois du dimanche de la semaine affichée.
 * Les bornes civiles sont converties séparément pour respecter les changements d'heure.
 */
export function calculateRestaurantRecap(shifts: ShiftTimeInterval[], weekDate: Date) {
  const monday = startOfWeek(toAppTime(weekDate), { weekStartsOn: 1 });
  const nextMonday = addDays(monday, 7);
  const sunday = addDays(monday, 6);
  const weekStart = fromAppTime(monday);
  const weekEnd = fromAppTime(nextMonday);
  const monthStart = fromAppTime(startOfMonth(sunday));

  return {
    weeklyHours: hoursWithin(shifts, weekStart, weekEnd),
    monthlyHours: hoursWithin(shifts, monthStart, weekEnd),
  };
}
