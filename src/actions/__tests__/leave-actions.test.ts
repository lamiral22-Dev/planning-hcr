/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addDays, format } from "date-fns";
import { createLeaveRequest, reviewLeaveRequest } from "@/actions/leave-actions";
import { prisma } from "@/lib/prisma";
import * as auth from "@/lib/auth";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    leaveRequest: { findFirst: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), create: vi.fn(), update: vi.fn() },
    shift: { findMany: vi.fn(), update: vi.fn() },
    timeEntry: { findFirst: vi.fn() },
    shiftSwap: { findFirst: vi.fn() },
    shiftReplacementRequest: { findFirst: vi.fn() },
    companySettings: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(async (callback: (tx: any) => Promise<any>) => callback(prisma)),
  },
}));

const employee = { id: "employee", email: "e@example.fr", role: "SALARIE" as const, firstName: "A", lastName: "B" };
const manager = { ...employee, id: "manager", role: "MANAGER" as const };
const day = (offset: number) => format(addDays(new Date(), offset), "yyyy-MM-dd");
const leave = { id: "leave", userId: employee.id, type: "CP", status: "EN_ATTENTE", startDate: new Date(`${day(2)}T00:00:00Z`), endDate: new Date(`${day(10)}T00:00:00Z`) };

describe("demandes de congés", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(auth, "requireUserWithRoles").mockResolvedValue(employee);
    vi.mocked(prisma.leaveRequest.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.leaveRequest.create).mockResolvedValue(leave as any);
    vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue(leave as any);
    vi.mocked(prisma.leaveRequest.findUniqueOrThrow).mockResolvedValue(leave as any);
    vi.mocked(prisma.leaveRequest.update).mockResolvedValue({ ...leave, status: "APPROUVE" } as any);
    vi.mocked(prisma.companySettings.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.timeEntry.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.shiftSwap.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.shiftReplacementRequest.findFirst).mockResolvedValue(null);
  });

  it("crée et audite une demande pour le salarié authentifié", async () => {
    const result = await createLeaveRequest({ type: "CP", startDate: day(2), endDate: day(3), userId: "autre" });
    expect(result.success).toBe(true);
    expect(prisma.leaveRequest.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: employee.id }) }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "LEAVE_REQUESTED", userId: employee.id }) }));
  });

  it("refuse dates invalides et périodes inversées sans écriture", async () => {
    expect((await createLeaveRequest({ type: "CP", startDate: "2026-02-30", endDate: "2026-03-01" })).success).toBe(false);
    expect((await createLeaveRequest({ type: "RTT", startDate: day(3), endDate: day(2) })).success).toBe(false);
    expect(prisma.leaveRequest.create).not.toHaveBeenCalled();
  });

  it("présente les conflits sans mutation avant confirmation", async () => {
    vi.mocked(auth.requireUserWithRoles).mockResolvedValue(manager);
    const shift = { id: "shift", planningVersion: 3, startTime: addDays(new Date(), 2), endTime: addDays(new Date(), 2), status: "PUBLIE" };
    vi.mocked(prisma.shift.findMany).mockResolvedValue([shift] as any);
    const result = await reviewLeaveRequest({ id: leave.id, approved: true });
    expect(result).toMatchObject({ success: true, data: { conflicts: [{ id: "shift" }] } });
    expect(prisma.shift.update).not.toHaveBeenCalled();
    expect(prisma.leaveRequest.update).not.toHaveBeenCalled();
  });

  it("maintient un shift publié tardif jusqu'à l'accord et audite la demande", async () => {
    vi.mocked(auth.requireUserWithRoles).mockResolvedValue(manager);
    const shift = { id: "shift", planningVersion: 3, startTime: addDays(new Date(), 2), endTime: addDays(new Date(), 2), status: "PUBLIE" };
    vi.mocked(prisma.shift.findMany).mockResolvedValue([shift] as any);
    vi.mocked(prisma.shift.update).mockResolvedValue({ ...shift, status: "EN_ATTENTE_DEROGATION" } as any);
    const result = await reviewLeaveRequest({ id: leave.id, approved: true, forceReleaseShifts: true, confirmedShifts: [{ id: "shift", planningVersion: 3 }] });
    expect(result.success).toBe(true);
    expect(prisma.shift.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "EN_ATTENTE_DEROGATION", leaveAction: "RELEASE", leaveRequestId: "leave", planningVersion: 4 }) }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "LEAVE_APPROVED" }) }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "SHIFT_LEAVE_RELEASE_REQUESTED" }) }));
  });

  it("ne libère pas un shift si la version confirmée a changé", async () => {
    vi.mocked(auth.requireUserWithRoles).mockResolvedValue(manager);
    vi.mocked(prisma.shift.findMany).mockResolvedValue([{ id: "shift", planningVersion: 4 }] as any);
    const result = await reviewLeaveRequest({ id: leave.id, approved: true, forceReleaseShifts: true, confirmedShifts: [{ id: "shift", planningVersion: 3 }] });
    expect(result).toMatchObject({ success: true, data: { conflicts: [{ id: "shift" }] } });
    expect(prisma.shift.update).not.toHaveBeenCalled();
  });
});
