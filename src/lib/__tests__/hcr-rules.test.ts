import { describe, it, expect } from "vitest";
import { checkDailyRest } from "@/lib/hcr-rules";

describe("checkDailyRest", () => {
  it("valide 11 heures de repos consécutives", () => {
    const end = new Date("2025-01-01T22:00:00Z");
    const nextStart = new Date("2025-01-02T09:00:00Z");
    expect(checkDailyRest(end, nextStart)).toBe(true);
  });

  it("invalide moins de 11 heures de repos", () => {
    const end = new Date("2025-01-01T23:00:00Z");
    const nextStart = new Date("2025-01-02T09:00:00Z");
    expect(checkDailyRest(end, nextStart)).toBe(false);
  });
});
