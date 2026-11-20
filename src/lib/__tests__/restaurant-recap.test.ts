import { describe, expect, it } from "vitest";
import { fromZonedTime } from "date-fns-tz";
import { calculateRestaurantRecap } from "@/lib/restaurant-recap";

function paris(value: string) {
  return fromZonedTime(value, "Europe/Paris");
}

describe("calculateRestaurantRecap", () => {
  it("remet le cumul mensuel à zéro sur une semaine à cheval sur deux mois", () => {
    const shifts = [
      { startTime: paris("2026-03-30T09:00:00"), endTime: paris("2026-03-30T17:00:00") },
      { startTime: paris("2026-04-01T09:00:00"), endTime: paris("2026-04-01T17:00:00") },
      { startTime: paris("2026-04-06T09:00:00"), endTime: paris("2026-04-06T17:00:00") },
    ];

    expect(calculateRestaurantRecap(shifts, paris("2026-03-30T12:00:00"))).toEqual({
      weeklyHours: 16,
      monthlyHours: 8,
    });
  });

  it("répartit un shift de nuit traversant le début du mois et de la semaine", () => {
    const shifts = [
      { startTime: paris("2026-01-31T22:00:00"), endTime: paris("2026-02-01T02:00:00") },
      { startTime: paris("2026-02-01T22:00:00"), endTime: paris("2026-02-02T02:00:00") },
    ];

    expect(calculateRestaurantRecap(shifts, paris("2026-02-02T12:00:00"))).toEqual({
      weeklyHours: 2,
      monthlyHours: 6,
    });
  });

  it("compte la durée réelle lors du changement d'heure à Paris", () => {
    const shifts = [
      { startTime: paris("2026-03-29T01:00:00"), endTime: paris("2026-03-29T04:00:00") },
    ];

    expect(calculateRestaurantRecap(shifts, paris("2026-03-29T12:00:00"))).toEqual({
      weeklyHours: 2,
      monthlyHours: 2,
    });
  });
});
