/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  requestShiftSwap,
  respondToSwapRequest,
  arbitrateShiftSwap,
} from "@/actions/swap-actions";
import { prisma } from "@/lib/prisma";
import * as auth from "@/lib/auth";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shift: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    shiftSwap: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
      return cb(prisma);
    }),
  },
}));

describe("swap-actions.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("requestShiftSwap", () => {
    it("refuse la demande si le shift n'est pas au statut PUBLIE", async () => {
      vi.spyOn(auth, "getCurrentUser").mockResolvedValue({
        id: "sal-1",
        email: "sal1@test.com",
        role: "SALARIE",
        firstName: "Cedant",
        lastName: "Employe",
      });

      vi.mocked(prisma.shift.findUnique).mockResolvedValue({
        id: "shift-1",
        userId: "sal-1",
        status: "BROUILLON", // non publié
      } as any);

      const res = await requestShiftSwap({
        shiftId: "shift-1",
        targetUserId: "sal-2",
        reason: "Imprévu familial",
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.code).toBe("INVALID_STATUS");
      }
    });

    it("crée la demande d'échange au statut EN_ATTENTE_EQUIPIER avec journalisation AuditLog", async () => {
      vi.spyOn(auth, "getCurrentUser").mockResolvedValue({
        id: "sal-1",
        email: "sal1@test.com",
        role: "SALARIE",
        firstName: "Cedant",
        lastName: "Employe",
      });

      vi.mocked(prisma.shift.findUnique).mockResolvedValue({
        id: "shift-1",
        userId: "sal-1",
        status: "PUBLIE",
      } as any);

      vi.mocked(prisma.shiftSwap.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "sal-2",
      } as any);

      vi.mocked(prisma.shiftSwap.create as any).mockImplementation(async ({ data }: any) => {
        return { id: "swap-1", ...data };
      });

      const res = await requestShiftSwap({
        shiftId: "shift-1",
        targetUserId: "sal-2",
        reason: "Besoin de repos",
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.status).toBe("EN_ATTENTE_EQUIPIER");
      }
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "SWAP_REQUESTED",
          }),
        })
      );
    });
  });

  describe("respondToSwapRequest", () => {
    it("refuse le swap si l'équipier repreneur décline", async () => {
      vi.spyOn(auth, "getCurrentUser").mockResolvedValue({
        id: "sal-2",
        email: "sal2@test.com",
        role: "SALARIE",
        firstName: "Repreneur",
        lastName: "Employe",
      });

      vi.mocked(prisma.shiftSwap.findUnique).mockResolvedValue({
        id: "swap-1",
        targetUserId: "sal-2",
        status: "EN_ATTENTE_EQUIPIER",
        shift: { id: "shift-1" },
      } as any);

      vi.mocked(prisma.shiftSwap.update as any).mockImplementation(async ({ data }: any) => {
        return { id: "swap-1", ...data };
      });

      const res = await respondToSwapRequest({
        swapId: "swap-1",
        accepted: false,
        rejectedReason: "Indisponible ce soir-là",
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.status).toBe("REFUSE");
      }
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "SWAP_REJECTED_BY_PEER",
          }),
        })
      );
    });

    it("bloque l'acceptation en cas de collision / chevauchement direct de shift", async () => {
      vi.spyOn(auth, "getCurrentUser").mockResolvedValue({
        id: "sal-2",
        email: "sal2@test.com",
        role: "SALARIE",
        firstName: "Repreneur",
        lastName: "Employe",
      });

      const shiftStart = new Date("2025-06-10T12:00:00Z");
      const shiftEnd = new Date("2025-06-10T18:00:00Z");

      vi.mocked(prisma.shiftSwap.findUnique).mockResolvedValue({
        id: "swap-1",
        targetUserId: "sal-2",
        status: "EN_ATTENTE_EQUIPIER",
        shift: {
          id: "shift-1",
          startTime: shiftStart,
          endTime: shiftEnd,
        },
      } as any);

      // Le repreneur a déjà un shift en chevauchement (14:00 - 20:00)
      vi.mocked(prisma.shift.findMany).mockResolvedValue([
        {
          id: "existing-shift",
          startTime: new Date("2025-06-10T14:00:00Z"),
          endTime: new Date("2025-06-10T20:00:00Z"),
        } as any,
      ]);

      const res = await respondToSwapRequest({
        swapId: "swap-1",
        accepted: true,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.code).toBe("SHIFT_COLLISION");
      }
    });

    it("accepte et bascule en EN_ATTENTE_MANAGER si conforme HCR", async () => {
      vi.spyOn(auth, "getCurrentUser").mockResolvedValue({
        id: "sal-2",
        email: "sal2@test.com",
        role: "SALARIE",
        firstName: "Repreneur",
        lastName: "Employe",
      });

      const shiftStart = new Date("2025-06-10T12:00:00Z");
      const shiftEnd = new Date("2025-06-10T18:00:00Z");

      vi.mocked(prisma.shiftSwap.findUnique).mockResolvedValue({
        id: "swap-1",
        targetUserId: "sal-2",
        status: "EN_ATTENTE_EQUIPIER",
        shift: {
          id: "shift-1",
          startTime: shiftStart,
          endTime: shiftEnd,
        },
      } as any);

      vi.mocked(prisma.shift.findMany).mockResolvedValue([]);
      vi.mocked(prisma.shiftSwap.update as any).mockImplementation(async ({ data }: any) => {
        return { id: "swap-1", ...data };
      });

      const res = await respondToSwapRequest({
        swapId: "swap-1",
        accepted: true,
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.status).toBe("EN_ATTENTE_MANAGER");
      }
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "SWAP_ACCEPTED_BY_PEER",
          }),
        })
      );
    });
  });

  describe("arbitrateShiftSwap", () => {
    it("valide l'échange, réassigne le shift au repreneur et réinitialise acknowledgedAt à null", async () => {
      vi.spyOn(auth, "requireUserWithRoles").mockResolvedValue({
        id: "mgr-1",
        email: "mgr@test.com",
        role: "MANAGER",
        firstName: "Directeur",
        lastName: "Restaurant",
      });

      const shiftStart = new Date("2025-06-10T12:00:00Z");
      const shiftEnd = new Date("2025-06-10T18:00:00Z");

      const existingShift = {
        id: "shift-1",
        userId: "sal-1",
        acknowledgedAt: new Date("2025-06-01T10:00:00Z"),
        planningVersion: 1,
        startTime: shiftStart,
        endTime: shiftEnd,
      };

      vi.mocked(prisma.shiftSwap.findUnique).mockResolvedValue({
        id: "swap-1",
        shiftId: "shift-1",
        requesterId: "sal-1",
        targetUserId: "sal-2",
        status: "EN_ATTENTE_MANAGER",
        shift: existingShift,
      } as any);

      vi.mocked(prisma.shift.findMany).mockResolvedValue([]);
      vi.mocked(prisma.shift.update as any).mockImplementation(async ({ data }: any) => {
        return { ...existingShift, ...data };
      });
      vi.mocked(prisma.shiftSwap.update as any).mockImplementation(async ({ data }: any) => {
        return { id: "swap-1", status: data.status };
      });

      const res = await arbitrateShiftSwap({
        swapId: "swap-1",
        approved: true,
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.shift.userId).toBe("sal-2");
        expect(res.data.shift.acknowledgedAt).toBeNull();
        expect(res.data.swap.status).toBe("VALIDE");
      }

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "SWAP_APPROVED_BY_MANAGER",
            payloadNew: expect.objectContaining({
              newUserId: "sal-2",
              acknowledgedAt: null,
            }),
          }),
        })
      );
    });
  });
});
