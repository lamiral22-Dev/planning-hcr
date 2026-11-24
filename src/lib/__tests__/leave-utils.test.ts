/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import { accruedLeaveDays, canReserveLeave, conflictingLeaves, countLeaveDays, leaveDate, leaveInterval, remainingLeaveDays, removeLeaveDays, shiftLeaveDays } from "@/lib/leave-utils";
import { shiftDatesForDay } from "@/lib/time-utils";

describe("congés et jours civils de Paris", () => {
  it("décompte les jours ouvrables hors dimanche et jours fériés", () => {
    expect(countLeaveDays("2026-05-01", "2026-05-03")).toBe(1);
    expect(countLeaveDays("2026-05-04", "2026-05-08")).toBe(4);
    expect(countLeaveDays("2026-05-04", "2026-05-04")).toBe(1);
    expect(countLeaveDays("2026-04-06", "2026-04-06")).toBe(0);
  });

  it("crédite 2,5 jours chaque premier du mois après l'embauche", () => {
    expect(accruedLeaveDays(new Date("2026-01-16T00:00:00Z"), new Date("2026-01-30T00:00:00Z"))).toBe(0);
    expect(accruedLeaveDays(new Date("2026-01-16T00:00:00Z"), new Date("2026-01-31T00:00:00Z"))).toBe(0);
    expect(accruedLeaveDays(new Date("2026-01-16T00:00:00Z"), new Date("2026-02-01T00:00:00Z"))).toBe(2.5);
    expect(accruedLeaveDays(new Date("2026-01-16T00:00:00Z"), new Date("2026-03-01T00:00:00Z"))).toBe(5);
    expect(accruedLeaveDays(new Date("2026-02-01T00:00:00Z"), new Date("2026-04-01T00:00:00Z"))).toBe(7.5);
  });

  it("projette les droits au début du congé et protège les réservations ultérieures", () => {
    const hire = new Date("2026-11-02T10:00:00Z");
    expect(remainingLeaveDays(hire, 0, [], "2026-11-30")).toBe(0);
    expect(remainingLeaveDays(hire, 0, [], "2026-12-01")).toBe(2.5);
    expect(canReserveLeave(hire, 0, [], { startDate: "2026-11-30", endDate: "2026-11-30" })).toBe(false);
    expect(canReserveLeave(hire, 0, [], { startDate: "2026-12-01", endDate: "2026-12-02" })).toBe(true);
    expect(canReserveLeave(hire, 0, [], { startDate: "2026-12-01", endDate: "2026-12-03" })).toBe(false);
    const future = [{ startDate: "2026-12-10", endDate: "2026-12-11" }];
    expect(canReserveLeave(hire, 0, future, { startDate: "2026-12-01", endDate: "2026-12-01" })).toBe(false);
    expect(remainingLeaveDays(hire, 0, future, "2026-11-30")).toBe(0);
    expect(remainingLeaveDays(hire, 0, [{ startDate: "2026-12-01", endDate: "2026-12-02" }], "2026-12-01")).toBe(2.5);
    expect(remainingLeaveDays(hire, 0, [{ startDate: "2026-12-01", endDate: "2026-12-02" }], "2026-12-02")).toBe(1.5);
  });

  it("inclut les deux jours d'un service de nuit et respecte le changement d'heure", () => {
    const shift = shiftDatesForDay("2026-03-28", "22:00", "02:00");
    expect(shiftLeaveDays(shift.startTime, shift.endTime)).toEqual({ first: "2026-03-28", last: "2026-03-29" });
    const interval = leaveInterval({ startDate: leaveDate("2026-03-29"), endDate: leaveDate("2026-03-29") });
    expect(interval.end.getTime() - interval.start.getTime()).toBe(23 * 60 * 60 * 1000);
  });

  it("recherche les congés chevauchant les deux jours du service", async () => {
    const tx = { leaveRequest: { findMany: vi.fn().mockResolvedValue([]) } };
    const shift = shiftDatesForDay("2026-04-04", "22:00", "02:00");
    await conflictingLeaves(tx as any, "e", shift.startTime, shift.endTime);
    expect(tx.leaveRequest.findMany).toHaveBeenCalledWith({ where: {
      userId: "e", status: "APPROUVE", startDate: { lte: leaveDate("2026-04-05") }, endDate: { gte: leaveDate("2026-04-04") },
    } });
  });

  it("scinde le congé et audite les deux fragments", async () => {
    const leave = { id: "l", userId: "e", type: "CP", status: "APPROUVE", startDate: leaveDate("2026-04-01"), endDate: leaveDate("2026-04-05"), reason: null, reviewedById: "m", reviewComment: null };
    const tx = { leaveRequest: { update: vi.fn().mockResolvedValue({ ...leave, endDate: leaveDate("2026-04-02") }), create: vi.fn().mockResolvedValue({ id: "rest" }) }, auditLog: { create: vi.fn() } };
    await removeLeaveDays(tx as any, leave as any, "2026-04-03", "2026-04-03", "m", "s");
    expect(tx.leaveRequest.update).toHaveBeenCalledWith({ where: { id: "l" }, data: { endDate: leaveDate("2026-04-02") } });
    expect(tx.leaveRequest.create).toHaveBeenCalledWith({ data: expect.objectContaining({ startDate: leaveDate("2026-04-04"), endDate: leaveDate("2026-04-05"), status: "APPROUVE" }) });
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "LEAVE_OVERRIDDEN", recordId: "l" }) });
  });
});
