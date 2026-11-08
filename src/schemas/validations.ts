import { z } from "zod";

export const RoleEnum = z.enum(["SALARIE", "MANAGER", "SUPER_ADMIN"]);
export const ShiftStatusEnum = z.enum([
  "BROUILLON",
  "PUBLIE",
  "EN_ATTENTE_DEROGATION",
  "ANNULE",
]);
export const SwapStatusEnum = z.enum([
  "EN_ATTENTE_EQUIPIER",
  "EN_ATTENTE_MANAGER",
  "VALIDE",
  "REFUSE",
]);
export const QualificationStatusEnum = z.enum([
  "CONFORME",
  "HEURES_MODIFIEES",
  "RETARD",
  "ABSENT_INJUSTIFIE",
  "MALADIE",
  "VACANCES",
]);

// --- SHIFT SCHEMAS ---
export const ShiftSchema = z
  .object({
    id: z.string().optional(),
    userId: z.string().min(1, "L'identifiant salarié est requis"),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    status: ShiftStatusEnum.default("BROUILLON"),
    acknowledgedAt: z.coerce.date().optional().nullable(),
    isLateModification: z.boolean().default(false),
    derogationRequestedAt: z.coerce.date().optional().nullable(),
    derogationAcceptedAt: z.coerce.date().optional().nullable(),
    derogationComment: z.string().optional().nullable(),
    planningVersion: z.number().int().default(1),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "L'heure de fin doit être postérieure à l'heure de début",
    path: ["endTime"],
  });

export const AcknowledgeShiftSchema = z.object({
  shiftId: z.string().min(1, "L'identifiant du shift est requis"),
  acknowledgedAt: z.coerce.date().default(() => new Date()),
});

export const DerogationAgreementSchema = z.object({
  shiftId: z.string().min(1, "L'identifiant du shift est requis"),
  derogationAcceptedAt: z.coerce.date().default(() => new Date()),
  comment: z.string().optional(),
});

// --- TIME ENTRY SCHEMAS ---
export const ClockInSchema = z.object({
  userId: z.string().min(1, "L'identifiant salarié est requis"),
  shiftId: z.string().optional().nullable(),
  clockInTime: z.coerce.date().default(() => new Date()),
});

export const ClockOutSchema = z.object({
  timeEntryId: z.string().min(1, "L'identifiant du pointage est requis"),
  rawClockOutTime: z.coerce.date().default(() => new Date()),
  discrepancyReason: z.string().optional().nullable(),
});

export const ArbitrateTimeEntrySchema = z
  .object({
    timeEntryId: z.string().min(1, "L'identifiant du pointage est requis"),
    managerId: z.string().min(1, "L'identifiant manager est requis"),
    qualification: QualificationStatusEnum,
    arbitrationReason: z
      .string()
      .min(3, "Le motif de rectification est obligatoire (minimum 3 caractères)"),
    correctedClockInTime: z.coerce.date().optional().nullable(),
    correctedClockOutTime: z.coerce.date().optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.correctedClockInTime && data.correctedClockOutTime) {
        return data.correctedClockOutTime > data.correctedClockInTime;
      }
      return true;
    },
    {
      message: "L'heure de fin rectifiée doit être postérieure à l'heure de début rectifiée",
      path: ["correctedClockOutTime"],
    }
  );

// --- SWAP SCHEMAS ---
export const SwapRequestSchema = z
  .object({
    shiftId: z.string().min(1, "Le shift d'origine est requis"),
    requesterId: z.string().min(1, "Le salarié demandeur est requis"),
    targetUserId: z.string().min(1, "Le salarié ciblé est requis"),
    reason: z.string().optional().nullable(),
  })
  .refine((data) => data.requesterId !== data.targetUserId, {
    message: "Vous ne pouvez pas échanger un shift avec vous-même",
    path: ["targetUserId"],
  });

export const PeerSwapResponseSchema = z.object({
  swapId: z.string().min(1, "L'identifiant d'échange est requis"),
  accepted: z.boolean(),
  rejectedReason: z.string().optional().nullable(),
});

export const ManagerSwapApprovalSchema = z.object({
  swapId: z.string().min(1, "L'identifiant d'échange est requis"),
  managerId: z.string().min(1, "L'identifiant manager est requis"),
  approved: z.boolean(),
  rejectedReason: z.string().optional().nullable(),
});

// --- COMPANY SETTINGS SCHEMAS ---
export const CompanySettingsSchema = z.object({
  id: z.string().default("default"),
  noticeDelayDays: z.number().int().min(0).default(8),
  roundingMinutes: z.number().int().min(1).default(15),
  maxWeeklyHours: z.number().positive().default(48.0),
  minDailyRestHours: z.number().positive().default(11.0),
});

// Types exportés
export type ShiftInput = z.infer<typeof ShiftSchema>;
export type SwapRequestInput = z.infer<typeof SwapRequestSchema>;
export type ArbitrateTimeEntryInput = z.infer<typeof ArbitrateTimeEntrySchema>;
export type CompanySettingsInput = z.infer<typeof CompanySettingsSchema>;
