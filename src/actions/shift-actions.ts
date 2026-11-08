"use server";

import { prisma } from "@/lib/prisma";
import { requireUserWithRoles, getCurrentUser } from "@/lib/auth";
import {
  ShiftSchema,
  AcknowledgeShiftSchema,
  DerogationAgreementSchema,
  type ShiftInput,
} from "@/schemas/validations";
import {
  validateConsecutiveShiftsDailyRest,
  validateWeeklyHours,
  validateWeeklyRestDays,
  validateMaxConsecutiveWorkedDays,
  checkNoticePeriod,
} from "@/lib/hcr-rules";
import { Prisma } from "@prisma/client";

export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string; fieldErrors?: Record<string, string[]> };

/**
 * Création d'un shift par un manager / super admin.
 * Contrôles stricts :
 *  - RBAC (MANAGER ou SUPER_ADMIN)
 *  - Validation Zod
 *  - Contrôles légaux HCR (11h repos quotidien, 48h hebdo, 2 jours repos hebdo, max 5 jours consécutifs)
 *  - Délai de prévenance (< 8 jours déclenche statut EN_ATTENTE_DEROGATION et isLateModification: true)
 *  - Transaction atomique Prisma avec création d'AuditLog.
 */
export async function createShift(input: ShiftInput): Promise<ActionResult> {
  try {
    const actor = await requireUserWithRoles(["MANAGER", "SUPER_ADMIN"]);
    const validated = ShiftSchema.parse(input);

    // Récupération des shifts existants du salarié pour contrôler la conformité HCR
    const existingShifts = await prisma.shift.findMany({
      where: {
        userId: validated.userId,
        status: { not: "ANNULE" },
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
      },
    });

    // 1. Contrôle du repos quotidien (11h)
    const combinedShifts = [
      ...existingShifts,
      { startTime: validated.startTime, endTime: validated.endTime },
    ];

    const dailyRestCheck = validateConsecutiveShiftsDailyRest(combinedShifts);
    if (!dailyRestCheck.isValid) {
      return {
        success: false,
        error: "Non-respect du repos quotidien légal (11h consécutives obligatoires).",
        code: "DAILY_REST_VIOLATION",
      };
    }

    // 2. Contrôle du plafond hebdomadaire (48h max)
    const weeklyHoursCheck = validateWeeklyHours(
      existingShifts,
      { startTime: validated.startTime, endTime: validated.endTime }
    );
    if (!weeklyHoursCheck.isValid) {
      return {
        success: false,
        error: `Dépassement du plafond hebdomadaire légal de 48h (cumul projeté : ${weeklyHoursCheck.totalHours}h).`,
        code: "WEEKLY_HOURS_EXCEEDED",
      };
    }

    // 3. Contrôle du repos hebdomadaire (2 jours de repos / max 5 jours consécutifs)
    const weeklyRestCheck = validateWeeklyRestDays(
      combinedShifts,
      validated.startTime
    );
    if (!weeklyRestCheck.isValid) {
      return {
        success: false,
        error: "Non-respect du repos hebdomadaire obligatoire (minimum 2 jours de repos par semaine civile).",
        code: "WEEKLY_REST_VIOLATION",
      };
    }

    const consecutiveDaysCheck = validateMaxConsecutiveWorkedDays(combinedShifts);
    if (!consecutiveDaysCheck.isValid) {
      return {
        success: false,
        error: `Interdiction de planifier plus de 5 jours consécutifs travaillés (${consecutiveDaysCheck.maxConsecutiveFound} jours trouvés).`,
        code: "CONSECUTIVE_DAYS_VIOLATION",
      };
    }

    // 4. Délai de prévenance (8 jours calendaires)
    const noticeCheck = checkNoticePeriod(validated.startTime, new Date());
    const isLate = noticeCheck.requiresDerogation;
    const finalStatus = isLate ? "EN_ATTENTE_DEROGATION" : validated.status;

    // Transaction atomique création Shift + AuditLog
    const result = await prisma.$transaction(async (tx) => {
      const shift = await tx.shift.create({
        data: {
          userId: validated.userId,
          startTime: validated.startTime,
          endTime: validated.endTime,
          status: finalStatus,
          isLateModification: isLate,
          derogationRequestedAt: isLate ? new Date() : null,
          planningVersion: validated.planningVersion ?? 1,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "SHIFT_CREATED",
          tableName: "Shift",
          recordId: shift.id,
          userId: actor.id,
          payloadNew: shift as unknown as Prisma.InputJsonValue,
          timestamp: new Date(),
        },
      });

      return shift;
    });

    return { success: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return { success: false, error: message };
  }
}

/**
 * Modification d'un shift par un manager / super admin.
 * Contrôles stricts :
 *  - RBAC (MANAGER ou SUPER_ADMIN)
 *  - Sauvegarde de l'ancien état
 *  - Contrôles HCR recalculés
 *  - Recalcul du délai de prévenance (J < 8 => EN_ATTENTE_DEROGATION)
 *  - Transaction atomique avec AuditLog (payloadOld et payloadNew).
 */
export async function updateShift(
  shiftId: string,
  input: Partial<ShiftInput>
): Promise<ActionResult> {
  try {
    const actor = await requireUserWithRoles(["MANAGER", "SUPER_ADMIN"]);

    const currentShift = await prisma.shift.findUnique({
      where: { id: shiftId },
    });

    if (!currentShift) {
      return { success: false, error: "Shift introuvable", code: "NOT_FOUND" };
    }

    const updatedData = {
      userId: input.userId ?? currentShift.userId,
      startTime: input.startTime ?? currentShift.startTime,
      endTime: input.endTime ?? currentShift.endTime,
      planningVersion: (currentShift.planningVersion || 1) + 1,
    };

    const validated = ShiftSchema.parse(updatedData);

    // Shifts existants hors celui modifié
    const otherShifts = await prisma.shift.findMany({
      where: {
        userId: validated.userId,
        id: { not: shiftId },
        status: { not: "ANNULE" },
      },
      select: { id: true, startTime: true, endTime: true },
    });

    const combinedShifts = [
      ...otherShifts,
      { startTime: validated.startTime, endTime: validated.endTime },
    ];

    const dailyRestCheck = validateConsecutiveShiftsDailyRest(combinedShifts);
    if (!dailyRestCheck.isValid) {
      return {
        success: false,
        error: "Non-respect du repos quotidien légal (11h consécutives obligatoires).",
        code: "DAILY_REST_VIOLATION",
      };
    }

    const weeklyHoursCheck = validateWeeklyHours(otherShifts, {
      startTime: validated.startTime,
      endTime: validated.endTime,
    });
    if (!weeklyHoursCheck.isValid) {
      return {
        success: false,
        error: `Dépassement du plafond hebdomadaire légal de 48h (${weeklyHoursCheck.totalHours}h).`,
        code: "WEEKLY_HOURS_EXCEEDED",
      };
    }

    const weeklyRestCheck = validateWeeklyRestDays(
      combinedShifts,
      validated.startTime
    );
    if (!weeklyRestCheck.isValid) {
      return {
        success: false,
        error: "Non-respect du repos hebdomadaire obligatoire.",
        code: "WEEKLY_REST_VIOLATION",
      };
    }

    const consecutiveDaysCheck = validateMaxConsecutiveWorkedDays(combinedShifts);
    if (!consecutiveDaysCheck.isValid) {
      return {
        success: false,
        error: "Plus de 5 jours consécutifs travaillés.",
        code: "CONSECUTIVE_DAYS_VIOLATION",
      };
    }

    // Délai de prévenance recalculé à la modification
    const noticeCheck = checkNoticePeriod(validated.startTime, new Date());
    const isLate = noticeCheck.requiresDerogation;
    const finalStatus = isLate ? "EN_ATTENTE_DEROGATION" : currentShift.status;

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.shift.update({
        where: { id: shiftId },
        data: {
          startTime: validated.startTime,
          endTime: validated.endTime,
          userId: validated.userId,
          status: finalStatus,
          isLateModification: isLate,
          derogationRequestedAt: isLate ? new Date() : null,
          derogationAcceptedAt: isLate ? null : currentShift.derogationAcceptedAt,
          planningVersion: updatedData.planningVersion,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "SHIFT_UPDATED",
          tableName: "Shift",
          recordId: shiftId,
          userId: actor.id,
          payloadOld: currentShift as unknown as Prisma.InputJsonValue,
          payloadNew: updated as unknown as Prisma.InputJsonValue,
          timestamp: new Date(),
        },
      });

      return updated;
    });

    return { success: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return { success: false, error: message };
  }
}

/**
 * Émargement standard du collaborateur pour le planning publié.
 * Enregistre obligatoirement la version exacte du planning (planningVersion) au moment de la signature.
 * RBAC : SALARIE titulaire du créneau (ou MANAGER/SUPER_ADMIN).
 */
export async function acknowledgeShift(input: {
  shiftId: string;
}): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "UNAUTHORIZED", code: "UNAUTHORIZED" };
    }

    const validated = AcknowledgeShiftSchema.parse(input);

    const shift = await prisma.shift.findUnique({
      where: { id: validated.shiftId },
    });

    if (!shift) {
      return { success: false, error: "Shift introuvable", code: "NOT_FOUND" };
    }

    // Le salarié ne peut émarger que pour lui-même
    if (user.role === "SALARIE" && shift.userId !== user.id) {
      return { success: false, error: "Accès refusé", code: "FORBIDDEN" };
    }

    const acknowledgeTimestamp = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const updatedShift = await tx.shift.update({
        where: { id: shift.id },
        data: {
          acknowledgedAt: acknowledgeTimestamp,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "SHIFT_ACKNOWLEDGED",
          tableName: "Shift",
          recordId: shift.id,
          userId: user.id,
          payloadOld: {
            acknowledgedAt: shift.acknowledgedAt,
            planningVersion: shift.planningVersion,
          },
          payloadNew: {
            acknowledgedAt: acknowledgeTimestamp,
            acknowledgedVersion: shift.planningVersion,
            signedBy: user.id,
          },
          timestamp: acknowledgeTimestamp,
        },
      });

      return updatedShift;
    });

    return { success: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return { success: false, error: message };
  }
}

/**
 * Acceptation expresse par l'équipier d'une modification tardive (J < 8).
 * RBAC : SALARIE titulaire du créneau.
 */
export async function acceptDerogation(input: {
  shiftId: string;
  comment?: string;
}): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "UNAUTHORIZED", code: "UNAUTHORIZED" };
    }

    const validated = DerogationAgreementSchema.parse(input);

    const shift = await prisma.shift.findUnique({
      where: { id: validated.shiftId },
    });

    if (!shift) {
      return { success: false, error: "Shift introuvable", code: "NOT_FOUND" };
    }

    if (user.role === "SALARIE" && shift.userId !== user.id) {
      return { success: false, error: "Accès refusé", code: "FORBIDDEN" };
    }

    const acceptanceTime = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.shift.update({
        where: { id: shift.id },
        data: {
          status: "PUBLIE",
          derogationAcceptedAt: acceptanceTime,
          derogationComment: validated.comment ?? null,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "DEROGATION_ACCEPTED",
          tableName: "Shift",
          recordId: shift.id,
          userId: user.id,
          payloadOld: {
            status: shift.status,
            derogationAcceptedAt: shift.derogationAcceptedAt,
          },
          payloadNew: {
            status: "PUBLIE",
            derogationAcceptedAt: acceptanceTime,
            derogationComment: validated.comment ?? null,
          },
          timestamp: acceptanceTime,
        },
      });

      return updated;
    });

    return { success: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return { success: false, error: message };
  }
}
