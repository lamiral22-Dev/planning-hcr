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

// --- MASTER TEMPLATE SCHEMAS ---
export const MasterTemplateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Le nom du créneau est obligatoire"),
  weekNumber: z.number().int().min(1).max(2),
  dayOfWeek: z.number().int().min(1).max(7),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Format heure invalide (HH:mm)"),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Format heure invalide (HH:mm)"),
  roleTarget: RoleEnum.default("SALARIE"),
  isActive: z.boolean().default(true),
});

// --- MISSED CLOCK-IN SCHEMA ---
export const MissedClockInSchema = z.object({
  shiftId: z.string().min(1, "L'identifiant du shift est obligatoire"),
  actualStartTime: z.coerce.date(),
  actualEndTime: z.coerce.date(),
  reason: z.string().min(1, "Le motif de régularisation est obligatoire"),
});

// --- USER MANAGEMENT SCHEMAS ---
export const CreateUserSchema = z.object({
  matricule: z
    .string()
    .min(2, "Le matricule doit comporter au moins 2 caractères")
    .max(50, "Le matricule est trop long")
    .trim(),
  firstName: z
    .string()
    .min(1, "Le prénom est obligatoire")
    .max(100)
    .trim(),
  lastName: z
    .string()
    .min(1, "Le nom est obligatoire")
    .max(100)
    .trim(),
  email: z
    .string()
    .email("Format d'adresse email invalide")
    .toLowerCase()
    .trim(),
  role: RoleEnum.default("SALARIE"),
  contractWeeklyHours: z
    .number({ invalid_type_error: "Le volume contractuel doit être un nombre" })
    .min(1, "Le volume horaire hebdomadaire doit être d'au moins 1h")
    .max(48, "Le volume horaire ne peut excéder 48h (plafond légal)")
    .default(35.0),
  password: z
    .string()
    .min(6, "Le mot de passe doit comporter au moins 6 caractères")
    .optional(),
  isActive: z.boolean().default(true),
});

export const UpdateUserSchema = z.object({
  id: z.string().min(1, "L'identifiant salarié est obligatoire"),
  matricule: z
    .string()
    .min(2, "Le matricule doit comporter au moins 2 caractères")
    .max(50)
    .trim()
    .optional(),
  firstName: z
    .string()
    .min(1, "Le prénom est obligatoire")
    .max(100)
    .trim()
    .optional(),
  lastName: z
    .string()
    .min(1, "Le nom est obligatoire")
    .max(100)
    .trim()
    .optional(),
  email: z
    .string()
    .email("Format d'adresse email invalide")
    .toLowerCase()
    .trim()
    .optional(),
  role: RoleEnum.optional(),
  contractWeeklyHours: z
    .number({ invalid_type_error: "Le volume contractuel doit être un nombre" })
    .min(1, "Le volume horaire hebdomadaire doit être d'au moins 1h")
    .max(48, "Le volume horaire ne peut excéder 48h")
    .optional(),
  password: z
    .string()
    .min(6, "Le mot de passe doit comporter au moins 6 caractères")
    .optional()
    .or(z.literal("")),
  isActive: z.boolean().optional(),
});

export const ToggleUserStatusSchema = z.object({
  userId: z.string().min(1, "L'identifiant salarié est requis"),
  isActive: z.boolean(),
});

// --- AUDIT QUERY SCHEMA ---
export const AuditQuerySchema = z.object({
  userId: z.string().optional().nullable(),
  action: z.string().optional().nullable(),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  limit: z.number().int().min(1).max(500).default(100).optional(),
  offset: z.number().int().min(0).default(0).optional(),
});

// Types exportés
export type ShiftInput = z.infer<typeof ShiftSchema>;
export type SwapRequestInput = z.infer<typeof SwapRequestSchema>;
export type ArbitrateTimeEntryInput = z.infer<typeof ArbitrateTimeEntrySchema>;
export type CompanySettingsInput = z.infer<typeof CompanySettingsSchema>;
export type MasterTemplateInput = z.infer<typeof MasterTemplateSchema>;
export type MissedClockInInput = z.infer<typeof MissedClockInSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type ToggleUserStatusInput = z.infer<typeof ToggleUserStatusSchema>;
export type AuditQueryInput = z.input<typeof AuditQuerySchema>;
