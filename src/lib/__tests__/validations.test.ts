import { describe, it, expect } from "vitest";
import {
  ShiftSchema,
  ArbitrateTimeEntrySchema,
  SwapRequestSchema,
  CompanySettingsSchema,
} from "@/schemas/validations";

describe("Validations Zod", () => {
  describe("ShiftSchema", () => {
    it("valide un shift valide", () => {
      const shift = {
        userId: "user-123",
        startTime: "2025-01-01T08:00:00.000Z",
        endTime: "2025-01-01T16:00:00.000Z",
        status: "PUBLIE",
      };
      expect(() => ShiftSchema.parse(shift)).not.toThrow();
    });

    it("rejette un shift dont endTime est antérieur à startTime", () => {
      const shift = {
        userId: "user-123",
        startTime: "2025-01-01T16:00:00.000Z",
        endTime: "2025-01-01T08:00:00.000Z",
      };
      expect(() => ShiftSchema.parse(shift)).toThrowError(
        "L'heure de fin doit être postérieure à l'heure de début"
      );
    });
  });

  describe("ArbitrateTimeEntrySchema", () => {
    it("valide un arbitrage complet avec motif", () => {
      const arbitration = {
        timeEntryId: "entry-1",
        managerId: "mgr-1",
        qualification: "HEURES_MODIFIEES",
        arbitrationReason: "Départ décalé validé en service coup de feu",
        correctedClockInTime: "2025-01-01T08:00:00.000Z",
        correctedClockOutTime: "2025-01-01T17:00:00.000Z",
      };
      expect(() => ArbitrateTimeEntrySchema.parse(arbitration)).not.toThrow();
    });

    it("rejette un arbitrage sans motif de rectification", () => {
      const arbitration = {
        timeEntryId: "entry-1",
        managerId: "mgr-1",
        qualification: "RETARD",
        arbitrationReason: "",
      };
      expect(() => ArbitrateTimeEntrySchema.parse(arbitration)).toThrowError(
        "motif de rectification est obligatoire"
      );
    });
  });

  describe("SwapRequestSchema", () => {
    it("valide une demande d'échange entre deux salariés distincts", () => {
      const swap = {
        shiftId: "shift-1",
        requesterId: "user-1",
        targetUserId: "user-2",
        reason: "Imprévu familial",
      };
      expect(() => SwapRequestSchema.parse(swap)).not.toThrow();
    });

    it("rejette une demande d'échange avec soi-même", () => {
      const swap = {
        shiftId: "shift-1",
        requesterId: "user-1",
        targetUserId: "user-1",
      };
      expect(() => SwapRequestSchema.parse(swap)).toThrowError(
        "Vous ne pouvez pas échanger un shift avec vous-même"
      );
    });
  });

  describe("CompanySettingsSchema", () => {
    it("valide les paramètres par défaut HCR", () => {
      const parsed = CompanySettingsSchema.parse({});
      expect(parsed.noticeDelayDays).toBe(8);
      expect(parsed.roundingMinutes).toBe(15);
      expect(parsed.maxWeeklyHours).toBe(48.0);
      expect(parsed.minDailyRestHours).toBe(11.0);
    });
  });
});
