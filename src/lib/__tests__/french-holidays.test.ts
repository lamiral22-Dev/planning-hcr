import { describe, expect, it } from "vitest";
import { getFrenchPublicHolidays } from "@/lib/french-holidays";
import { countLeaveDays } from "@/lib/leave-utils";

describe("jours fériés nationaux", () => {
  it("retourne les onze dates fixes et mobiles en 2026", () => {
    expect(getFrenchPublicHolidays(2026)).toEqual([
      { date: "2026-01-01", name: "Jour de l'an" },
      { date: "2026-04-06", name: "Lundi de Pâques" },
      { date: "2026-05-01", name: "Fête du Travail" },
      { date: "2026-05-08", name: "Victoire 1945" },
      { date: "2026-05-14", name: "Ascension" },
      { date: "2026-05-25", name: "Lundi de Pentecôte" },
      { date: "2026-07-14", name: "Fête Nationale" },
      { date: "2026-08-15", name: "Assomption" },
      { date: "2026-11-01", name: "Toussaint" },
      { date: "2026-11-11", name: "Armistice" },
      { date: "2026-12-25", name: "Noël" },
    ]);
  });

  it("calcule les fêtes mobiles d'autres années et les exclut des CP", () => {
    expect(getFrenchPublicHolidays(2024).map((day) => day.date)).toEqual(expect.arrayContaining(["2024-04-01", "2024-05-09", "2024-05-20"]));
    expect(getFrenchPublicHolidays(2038).map((day) => day.date)).toEqual(expect.arrayContaining(["2038-04-26", "2038-06-03", "2038-06-14"]));
    expect(countLeaveDays("2026-12-24", "2027-01-02")).toBe(7);
  });
});
