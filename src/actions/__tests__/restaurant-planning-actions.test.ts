/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addDays, format } from "date-fns";
import { assignRestaurantSlot, respondToReplacementRequest, saveRestaurantSlot, toggleRestaurantClosure } from "@/actions/restaurant-planning-actions";
import { prisma } from "@/lib/prisma";
import * as auth from "@/lib/auth";
import { toAppTime } from "@/lib/time-utils";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    restaurantSlot: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    restaurantClosure: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    shiftReplacementRequest: { findFirst: vi.fn(), create: vi.fn() },
    user: { findFirst: vi.fn() },
    shift: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
    leaveRequest: { findMany: vi.fn().mockResolvedValue([]) },
    companySettings: { findUnique: vi.fn().mockResolvedValue(null) },
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    $transaction: vi.fn(async (callback: (tx: any) => Promise<any>) => callback(prisma)),
  },
}));

const manager = { id: "manager-1", email: "manager@test.fr", role: "MANAGER" as const, firstName: "Marc", lastName: "Manager" };

describe("restaurant-planning-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(auth, "requireUserWithRoles").mockResolvedValue(manager);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "employee-1", role: "SALARIE", isActive: true } as any);
    vi.mocked(prisma.restaurantClosure.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.restaurantSlot.findUnique).mockResolvedValue({
      id: "slot-1", name: "Préparation", startTime: "08:00", endTime: "11:00", closedDays: [], isActive: true,
    } as any);
  });

  it("crée et audite un poste de planning validé", async () => {
    const slot = { id: "slot-1", name: "Midi 3", startTime: "11:00", endTime: "15:00", closedDays: [], isActive: true };
    vi.mocked(prisma.restaurantSlot.create).mockResolvedValue(slot as any);

    expect(await saveRestaurantSlot({ ...slot, id: undefined })).toMatchObject({ success: true });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "RESTAURANT_SLOT_CREATED", tableName: "RestaurantSlot", recordId: "slot-1" }),
    }));
  });

  it("rejette une réponse de remplacement non booléenne avant toute écriture", async () => {
    vi.spyOn(auth, "getCurrentUser").mockResolvedValue({
      id: "employee-1", email: "employee@test.fr", role: "SALARIE", firstName: "E", lastName: "S",
    });
    expect(await respondToReplacementRequest("request-1", "false" as unknown as boolean)).toMatchObject({ success: false });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuse l'affectation dans une case fermée", async () => {
    vi.mocked(prisma.restaurantSlot.findUnique).mockResolvedValue({
      id: "slot-1", name: "Préparation", startTime: "08:00", endTime: "11:00", closedDays: [1, 2, 3, 4, 5, 6, 7], isActive: true,
    } as any);
    const monday = format(addDays(toAppTime(new Date()), 7), "yyyy-MM-dd");

    expect(await assignRestaurantSlot({ slotId: "slot-1", userId: "employee-1", date: monday })).toMatchObject({
      success: false,
      error: "Ce créneau est fermé à cette date.",
    });
    expect(prisma.shift.create).not.toHaveBeenCalled();
  });

  it("contrôle les shifts du seul salarié affecté sans bloquer sur une ancienne amplitude", async () => {
    const date = format(addDays(toAppTime(new Date()), 30), "yyyy-MM-dd");
    const historicDay = format(addDays(toAppTime(new Date()), -30), "yyyy-MM-dd");
    vi.mocked(prisma.shift.findMany)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { startTime: new Date(`${historicDay}T07:00:00Z`), endTime: new Date(`${historicDay}T11:00:00Z`) },
        { startTime: new Date(`${historicDay}T18:00:00Z`), endTime: new Date(`${historicDay}T21:00:00Z`) },
      ] as any);
    vi.mocked(prisma.shift.create).mockResolvedValue({ id: "new-shift" } as any);

    expect(await assignRestaurantSlot({ slotId: "slot-1", userId: "employee-1", date })).toMatchObject({ success: true });
    expect(prisma.shift.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: "employee-1", status: { not: "ANNULE" } }),
    }));
    expect(prisma.shift.create).toHaveBeenCalledOnce();
  });

  it("soumet un remplacement tardif à accord sans changer le shift initial", async () => {
    const day = format(addDays(toAppTime(new Date()), 2), "yyyy-MM-dd");
    const occupied = {
      id: "shift-1",
      slotId: "slot-1",
      userId: "employee-initial",
      startTime: new Date(`${day}T08:00:00Z`),
      endTime: new Date(`${day}T11:00:00Z`),
      status: "PUBLIE",
    };
    vi.mocked(prisma.restaurantSlot.findUnique).mockResolvedValue({
      id: "slot-1", name: "Préparation", startTime: "08:00", endTime: "11:00", closedDays: [], isActive: true,
    } as any);
    vi.mocked(prisma.shift.findMany).mockResolvedValue([occupied] as any);
    vi.mocked(prisma.shiftReplacementRequest.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.shiftReplacementRequest.create).mockResolvedValue({ ...occupied, id: "request-1" } as any);

    expect(await assignRestaurantSlot({ slotId: "slot-1", userId: "employee-1", date: day })).toMatchObject({
      success: true,
      data: { requestId: "request-1", pending: true },
    });

    expect(prisma.shift.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "SHIFT_REPLACEMENT_REQUESTED", recordId: "request-1" }),
    }));
  });

  it("bloque une affectation sur congé sans arbitrage explicite", async () => {
      const date = format(addDays(toAppTime(new Date()), 2), "yyyy-MM-dd");
      vi.mocked(prisma.leaveRequest.findMany).mockResolvedValueOnce([{ id: "leave-1", startDate: new Date(`${date}T00:00:00Z`), endDate: new Date(`${date}T00:00:00Z`), dayPeriod: "JOURNEE_COMPLETE" }] as any);
      expect(await assignRestaurantSlot({ slotId: "slot-1", userId: "employee-1", date })).toMatchObject({
        success: false, code: "LEAVE_CONFLICT",
      });
      expect(prisma.shift.create).not.toHaveBeenCalled();
  });

  it("maintient le congé lors d'une affectation tardive jusqu'à l'accord", async () => {
      const date = format(addDays(toAppTime(new Date()), 2), "yyyy-MM-dd");
      vi.mocked(prisma.leaveRequest.findMany).mockResolvedValueOnce([{ id: "leave-1", startDate: new Date(`${date}T00:00:00Z`), endDate: new Date(`${date}T00:00:00Z`), dayPeriod: "JOURNEE_COMPLETE" }] as any);
      vi.mocked(prisma.shift.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.shift.findMany).mockResolvedValue([]);
      vi.mocked(prisma.shift.create).mockResolvedValue({ id: "shift-1" } as any);
      expect(await assignRestaurantSlot({ slotId: "slot-1", userId: "employee-1", date, forceOverrideLeave: true })).toMatchObject({ success: true });
      expect(prisma.shift.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
        status: "EN_ATTENTE_DEROGATION", leaveAction: "OVERRIDE", leaveRequestId: "leave-1",
      }) }));
  });

  it("trace la fermeture ponctuelle d'une case", async () => {
    vi.mocked(prisma.restaurantClosure.create).mockResolvedValue({ id: "closure-1" } as any);

    expect(await toggleRestaurantClosure("slot-1", "2026-11-23")).toMatchObject({
      success: true,
      data: { closed: true },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "RESTAURANT_SLOT_CLOSED", recordId: "closure-1" }),
    }));
  });

  it("permet de rouvrir une date normalement fermée chaque semaine", async () => {
    const sunday = "2026-11-22";
    vi.mocked(prisma.restaurantSlot.findUnique).mockResolvedValue({
      id: "slot-1", name: "Préparation", startTime: "08:00", endTime: "11:00", closedDays: [6, 7], isActive: true,
    } as any);
    vi.mocked(prisma.restaurantClosure.create).mockResolvedValue({ id: "closure-open" } as any);

    expect(await toggleRestaurantClosure("slot-1", sunday)).toMatchObject({
      success: true,
      data: { closed: false },
    });
    expect(prisma.restaurantClosure.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ slotId: "slot-1", isClosed: false }),
    }));
  });
});
