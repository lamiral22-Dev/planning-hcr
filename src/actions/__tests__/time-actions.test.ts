/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  clockIn,
  clockOut,
  recordOperationalStatus,
  arbitrateTimeEntry,
} from "@/actions/time-actions";
import { prisma } from "@/lib/prisma";
import * as auth from "@/lib/auth";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    timeEntry: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    shift: {
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

describe("time-actions.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("clockIn", () => {
    it("applique strictement l'heure système new Date() lors de la prise de poste", async () => {
      vi.spyOn(auth, "getCurrentUser").mockResolvedValue({
        id: "sal-1",
        email: "sal@test.com",
        role: "SALARIE",
        firstName: "Lucas",
        lastName: "Chef",
      });

      vi.mocked(prisma.timeEntry.create as any).mockImplementation(async ({ data }: any) => {
        return { id: "entry-1", ...data };
      });

      const before = new Date();
      const res = await clockIn({ userId: "sal-1", shiftId: "shift-1" });
      const after = new Date();

      expect(res.success).toBe(true);
      if (res.success) {
        const entry = res.data as any;
        expect(entry.clockInTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
        expect(entry.clockInTime.getTime()).toBeLessThanOrEqual(after.getTime());
      }

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "CLOCK_IN",
            tableName: "TimeEntry",
          }),
        })
      );
    });

    it("refuse si un salarié tente de pointer pour un autre", async () => {
      vi.spyOn(auth, "getCurrentUser").mockResolvedValue({
        id: "sal-1",
        email: "sal@test.com",
        role: "SALARIE",
        firstName: "Lucas",
        lastName: "Chef",
      });

      const res = await clockIn({ userId: "sal-autre", shiftId: "shift-1" });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.code).toBe("FORBIDDEN");
      }
    });
  });

  describe("clockOut", () => {
    it("calcule automatiquement l'arrondi au quart d'heure et enregistre le motif en cas d'écart", async () => {
      vi.spyOn(auth, "getCurrentUser").mockResolvedValue({
        id: "sal-1",
        email: "sal@test.com",
        role: "SALARIE",
        firstName: "Lucas",
        lastName: "Chef",
      });

      vi.mocked(prisma.timeEntry.findUnique).mockResolvedValue({
        id: "entry-123",
        userId: "sal-1",
        clockInTime: new Date("2025-01-01T08:00:00Z"),
      } as any);

      vi.mocked(prisma.timeEntry.update as any).mockImplementation(async ({ data }: any) => {
        return { id: "entry-123", ...data };
      });

      const res = await clockOut({
        timeEntryId: "entry-123",
        discrepancyReason: "Coup de feu en cuisine en fin de service",
      });

      expect(res.success).toBe(true);
      if (res.success) {
        const updated = res.data as any;
        expect(updated.rawClockOutTime).toBeDefined();
        expect(updated.roundedClockOutTime).toBeDefined();
        expect(updated.discrepancyReason).toBe("Coup de feu en cuisine en fin de service");
      }

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "CLOCK_OUT",
          }),
        })
      );
    });
  });

  describe("recordOperationalStatus", () => {
    it("permet au manager d'enregistrer une absence/maladie à 0 heure", async () => {
      vi.spyOn(auth, "requireUserWithRoles").mockResolvedValue({
        id: "mgr-1",
        email: "mgr@test.com",
        role: "MANAGER",
        firstName: "Alice",
        lastName: "Directrice",
      });

      const shiftStart = new Date("2025-01-02T10:00:00Z");
      vi.mocked(prisma.shift.findUnique).mockResolvedValue({
        id: "shift-absent",
        userId: "sal-1",
        startTime: shiftStart,
        endTime: new Date("2025-01-02T18:00:00Z"),
      } as any);

      vi.mocked(prisma.timeEntry.create as any).mockImplementation(async ({ data }: any) => {
        return { id: "entry-op", ...data };
      });

      const res = await recordOperationalStatus(
        "shift-absent",
        "MALADIE",
        "Arrêt maladie reçu par email"
      );

      expect(res.success).toBe(true);
      if (res.success) {
        const created = res.data as any;
        expect(created.clockInTime).toEqual(shiftStart);
        expect(created.rawClockOutTime).toEqual(shiftStart);
        expect(created.qualification).toBe("MALADIE");
        expect(created.arbitrationReason).toBe("Arrêt maladie reçu par email");
      }

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "OPERATIONAL_STATUS_RECORDED",
          }),
        })
      );
    });
  });

  describe("arbitrateTimeEntry", () => {
    it("préserve le pointage brut initial et consigne la rectification managériale dans AuditLog", async () => {
      vi.spyOn(auth, "requireUserWithRoles").mockResolvedValue({
        id: "mgr-1",
        email: "mgr@test.com",
        role: "MANAGER",
        firstName: "Alice",
        lastName: "Directrice",
      });

      const originalClockIn = new Date("2025-01-02T08:00:00Z");
      const originalClockOut = new Date("2025-01-02T17:10:00Z");

      const existingEntry = {
        id: "entry-456",
        userId: "sal-1",
        clockInTime: originalClockIn,
        rawClockOutTime: originalClockOut,
        qualification: "CONFORME",
      };

      vi.mocked(prisma.timeEntry.findUnique).mockResolvedValue(existingEntry as any);
      vi.mocked(prisma.timeEntry.update as any).mockImplementation(async ({ data }: any) => {
        return { ...existingEntry, ...data };
      });

      const correctedClockOut = new Date("2025-01-02T16:30:00Z");

      const res = await arbitrateTimeEntry({
        timeEntryId: "entry-456",
        managerId: "mgr-1",
        qualification: "HEURES_MODIFIEES",
        arbitrationReason: "Départ anticipé autorisé par le chef de rang",
        correctedClockOutTime: correctedClockOut,
      });

      expect(res.success).toBe(true);
      if (res.success) {
        const arbitrated = res.data as any;
        // Données brutes préservées
        expect(arbitrated.clockInTime).toEqual(originalClockIn);
        expect(arbitrated.rawClockOutTime).toEqual(originalClockOut);
        // Données corrigées enregistrées
        expect(arbitrated.correctedClockOutTime).toEqual(correctedClockOut);
        expect(arbitrated.qualification).toBe("HEURES_MODIFIEES");
        expect(arbitrated.managerId).toBe("mgr-1");
      }

      // Vérification audit log
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "TIME_ENTRY_ARBITRATED",
            payloadOld: existingEntry,
          }),
        })
      );
    });
  });
});
