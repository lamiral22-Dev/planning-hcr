/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createShift,
  updateShift,
  acknowledgeShift,
  acceptDerogation,
  deleteShift,
  publishQuinzaine,
} from "@/actions/shift-actions";
import { prisma } from "@/lib/prisma";
import * as auth from "@/lib/auth";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shift: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
      return cb(prisma);
    }),
  },
}));

describe("shift-actions.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Publication", () => {
    it("trace chaque changement et ignore un brouillon modifié entre la sélection et le verrou", async () => {
      vi.spyOn(auth, "requireUserWithRoles").mockResolvedValue({
        id: "manager", email: "manager@test.com", role: "MANAGER", firstName: "M", lastName: "M",
      });
      const start = new Date(Date.now() + 30 * 86400000);
      const end = new Date(start.getTime() + 7 * 86400000);
      const draft = { id: "a", startTime: start, status: "BROUILLON", planningVersion: 1 };
      vi.mocked(prisma.shift.findMany).mockResolvedValue([{ id: "a" }, { id: "b" }] as any);
      vi.mocked(prisma.shift.findUnique)
        .mockResolvedValueOnce(draft as any)
        .mockResolvedValueOnce({ ...draft, id: "b", status: "PUBLIE" } as any);
      vi.mocked(prisma.shift.update).mockResolvedValue({ ...draft, status: "PUBLIE", planningVersion: 2 } as any);

      expect(await publishQuinzaine(start, end)).toMatchObject({
        success: true, data: { publishedCount: 1, derogationCount: 0 },
      });
      expect(prisma.shift.update).toHaveBeenCalledTimes(1);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          action: "SHIFT_PUBLISHED", recordId: "a",
          payloadOld: expect.objectContaining({ status: "BROUILLON" }),
          payloadNew: expect.objectContaining({ status: "PUBLIE" }),
        }),
      }));
    });

    it("refuse une période invalide sans modifier de shift", async () => {
      vi.spyOn(auth, "requireUserWithRoles").mockResolvedValue({
        id: "manager", email: "manager@test.com", role: "MANAGER", firstName: "M", lastName: "M",
      });
      expect((await publishQuinzaine(new Date("2026-02-02"), new Date("2026-02-01"))).success).toBe(false);
      expect(prisma.shift.update).not.toHaveBeenCalled();
    });
  });

  describe("Suppression d'un shift", () => {
    it("refuse un salarié et ne supprime rien", async () => {
      vi.spyOn(auth, "requireUserWithRoles").mockRejectedValue(new Error("FORBIDDEN"));
      expect((await deleteShift("shift-1")).success).toBe(false);
      expect(prisma.shift.delete).not.toHaveBeenCalled();
    });

    it("bloque les shifts ayant des pointages ou échanges", async () => {
      vi.spyOn(auth, "requireUserWithRoles").mockResolvedValue({
        id: "manager", email: "manager@test.com", role: "MANAGER", firstName: "M", lastName: "M",
      });
      vi.mocked(prisma.shift.findUnique).mockResolvedValue({
        id: "shift-1", _count: { timeEntries: 1, shiftSwaps: 0 },
      } as any);
      expect(await deleteShift("shift-1")).toMatchObject({ success: false, code: "HAS_TIME_ENTRIES" });
      expect(prisma.shift.delete).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it("supprime et audite atomiquement le shift sans pointage", async () => {
      vi.spyOn(auth, "requireUserWithRoles").mockResolvedValue({
        id: "manager", email: "manager@test.com", role: "MANAGER", firstName: "M", lastName: "M",
      });
      vi.mocked(prisma.shift.findUnique).mockResolvedValue({
        id: "shift-1", userId: "employee", _count: { timeEntries: 0, shiftSwaps: 0, replacementRequests: 0 },
      } as any);
      vi.mocked(prisma.shift.findUniqueOrThrow).mockResolvedValue({ id: "shift-1", userId: "employee" } as any);
      expect((await deleteShift("shift-1")).success).toBe(true);
      expect(prisma.shift.delete).toHaveBeenCalledWith({ where: { id: "shift-1" } });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ action: "SHIFT_DELETED", payloadOld: { id: "shift-1", userId: "employee" }, payloadNew: expect.anything() }),
      }));
    });
  });

  describe("RBAC", () => {
    it("refuse la création de shift à un salarié non-manager", async () => {
      vi.spyOn(auth, "requireUserWithRoles").mockRejectedValue(
        new Error("FORBIDDEN: Privilèges insuffisants")
      );

      const res = await createShift({
        userId: "target-user",
        startTime: new Date("2025-06-01T08:00:00Z"),
        endTime: new Date("2025-06-01T16:00:00Z"),
        status: "PUBLIE",
        isLateModification: false,
        planningVersion: 1,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain("FORBIDDEN");
      }
    });
  });

  describe("Garde-fous HCR à la planification", () => {
    it("bloque la création d'un shift violant les 11h de repos quotidien", async () => {
      vi.spyOn(auth, "requireUserWithRoles").mockResolvedValue({
        id: "manager-1",
        email: "mgr@test.com",
        role: "MANAGER",
        firstName: "Marc",
        lastName: "Manager",
      });

      // Shift existant se terminant à 23h00 le 01/06
      vi.mocked(prisma.shift.findMany).mockResolvedValue([
        {
          id: "shift-1",
          userId: "user-1",
          startTime: new Date("2025-06-01T15:00:00Z"),
          endTime: new Date("2025-06-01T23:00:00Z"),
        } as any,
      ]);

      // Nouveau shift commençant à 07h00 le 02/06 (8h d'intervalle < 11h)
      const res = await createShift({
        userId: "user-1",
        startTime: new Date("2025-06-02T07:00:00Z"),
        endTime: new Date("2025-06-02T15:00:00Z"),
        status: "PUBLIE",
        isLateModification: false,
        planningVersion: 1,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.code).toBe("DAILY_REST_VIOLATION");
      }
    });

    it("bascule automatiquement le statut en EN_ATTENTE_DEROGATION si planification à moins de 8 jours", async () => {
      vi.spyOn(auth, "requireUserWithRoles").mockResolvedValue({
        id: "manager-1",
        email: "mgr@test.com",
        role: "MANAGER",
        firstName: "Marc",
        lastName: "Manager",
      });

      vi.mocked(prisma.shift.findMany).mockResolvedValue([]);

      // Shift prévu dans 2 jours (J+2 < 8)
      const now = new Date();
      const inTwoDays = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
      const shiftEnd = new Date(inTwoDays.getTime() + 7 * 60 * 60 * 1000);

      vi.mocked(prisma.shift.create as any).mockImplementation(async ({ data }: any) => {
        return { id: "created-shift-id", ...data };
      });

      const res = await createShift({
        userId: "user-1",
        startTime: inTwoDays,
        endTime: shiftEnd,
        status: "PUBLIE",
        isLateModification: false,
        planningVersion: 1,
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect((res.data as any).status).toBe("EN_ATTENTE_DEROGATION");
        expect((res.data as any).isLateModification).toBe(true);
      }
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "SHIFT_CREATED",
          }),
        })
      );
    });

    it("met à jour un shift et conserve l'ancien état dans AuditLog", async () => {
      vi.spyOn(auth, "requireUserWithRoles").mockResolvedValue({
        id: "manager-1",
        email: "mgr@test.com",
        role: "MANAGER",
        firstName: "Marc",
        lastName: "Manager",
      });

      const existingShift = {
        id: "shift-to-update",
        userId: "user-1",
        startTime: new Date("2025-06-15T08:00:00Z"),
        endTime: new Date("2025-06-15T16:00:00Z"),
        status: "PUBLIE",
        planningVersion: 1,
      };

      vi.mocked(prisma.shift.findUnique).mockResolvedValue(existingShift as any);
      vi.mocked(prisma.shift.findMany).mockResolvedValue([]);
      vi.mocked(prisma.shift.update as any).mockImplementation(async ({ data }: any) => {
        return { ...existingShift, ...data };
      });

      const res = await updateShift("shift-to-update", {
        startTime: new Date("2025-06-15T09:00:00Z"),
        endTime: new Date("2025-06-15T17:00:00Z"),
      });

      expect(res.success).toBe(true);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "SHIFT_UPDATED",
            payloadOld: existingShift,
          }),
        })
      );
    });
  });

  describe("Émargement et acceptation de dérogation", () => {
    it("enregistre l'émargement légal avec la version du planning", async () => {
      vi.spyOn(auth, "getCurrentUser").mockResolvedValue({
        id: "salarie-1",
        email: "sal@test.com",
        role: "SALARIE",
        firstName: "Paul",
        lastName: "Salarie",
      });

      vi.mocked(prisma.shift.findUnique).mockResolvedValue({
        id: "shift-123",
        userId: "salarie-1",
        planningVersion: 2,
        acknowledgedAt: null,
      } as any);

      vi.mocked(prisma.shift.update as any).mockImplementation(async ({ data }: any) => {
        return { id: "shift-123", ...data };
      });

      const res = await acknowledgeShift({ shiftId: "shift-123" });
      expect(res.success).toBe(true);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "SHIFT_ACKNOWLEDGED",
            payloadNew: expect.objectContaining({
              acknowledgedVersion: 2,
            }),
          }),
        })
      );
    });

    it("enregistre l'acceptation de dérogation et repasse le shift en PUBLIE", async () => {
      vi.spyOn(auth, "getCurrentUser").mockResolvedValue({
        id: "salarie-1",
        email: "sal@test.com",
        role: "SALARIE",
        firstName: "Paul",
        lastName: "Salarie",
      });

      vi.mocked(prisma.shift.findUnique).mockResolvedValue({
        id: "shift-123",
        userId: "salarie-1",
        status: "EN_ATTENTE_DEROGATION",
      } as any);

      vi.mocked(prisma.shift.update as any).mockImplementation(async ({ data }: any) => {
        return { id: "shift-123", ...data };
      });

      const res = await acceptDerogation({
        shiftId: "shift-123",
        comment: "D'accord pour dépanner",
      });

      expect(res.success).toBe(true);
      expect(prisma.shift.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "PUBLIE",
            derogationComment: "D'accord pour dépanner",
          }),
        })
      );
    });
  });
});
