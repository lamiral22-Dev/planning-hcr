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
 * Instanciation de la quinzaine à partir de la grille type (MasterTemplate).
 * RBAC : MANAGER ou SUPER_ADMIN.
 * Pour chaque modèle de template actif, crée les shifts correspondants
 * pour les salariés éligibles sur la période de 14 jours débutant à startDate.
 */
export async function applyMasterTemplate(startDate: Date): Promise<ActionResult> {
  try {
    const actor = await requireUserWithRoles(["MANAGER", "SUPER_ADMIN"]);

    // Récupérer les templates actifs
    const templates = await prisma.masterTemplate.findMany({
      where: { isActive: true },
      orderBy: [{ weekNumber: "asc" }, { dayOfWeek: "asc" }],
    });

    if (templates.length === 0) {
      return {
        success: false,
        error: "Aucun planning type actif configuré.",
        code: "NO_ACTIVE_TEMPLATES",
      };
    }

    // Récupérer les utilisateurs salariés ciblés
    const employees = await prisma.user.findMany({
      where: { role: "SALARIE" },
      select: { id: true, role: true },
    });

    if (employees.length === 0) {
      return {
        success: false,
        error: "Aucun salarié disponible pour appliquer le planning type.",
        code: "NO_EMPLOYEES_FOUND",
      };
    }

    const createdShifts: ShiftInput[] = [];
    const baseDate = new Date(startDate);
    baseDate.setHours(0, 0, 0, 0);

    for (const template of templates) {
      // Calcul du jour cible (semaine 1 = offset 0 à 6 jours, semaine 2 = offset 7 à 13 jours)
      const weekOffset = (template.weekNumber - 1) * 7;
      // dayOfWeek : 1 (Lundi) -> 7 (Dimanche) => offset = dayOfWeek - 1
      const dayOffset = weekOffset + (template.dayOfWeek - 1);

      const targetDay = new Date(baseDate);
      targetDay.setDate(targetDay.getDate() + dayOffset);

      const [startH, startM] = template.startTime.split(":").map(Number);
      const [endH, endM] = template.endTime.split(":").map(Number);

      const shiftStart = new Date(targetDay);
      shiftStart.setHours(startH, startM, 0, 0);

      const shiftEnd = new Date(targetDay);
      shiftEnd.setHours(endH, endM, 0, 0);
      if (shiftEnd <= shiftStart) {
        shiftEnd.setDate(shiftEnd.getDate() + 1);
      }

      // Associer au premier salarié disponible ou filtré selon roleTarget
      const eligibleEmployee = employees.find((e) => e.role === template.roleTarget) ?? employees[0];

      createdShifts.push({
        userId: eligibleEmployee.id,
        startTime: shiftStart,
        endTime: shiftEnd,
        status: "BROUILLON",
        isLateModification: false,
        planningVersion: 1,
      });
    }

    const created = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const item of createdShifts) {
        const shift = await tx.shift.create({
          data: {
            userId: item.userId,
            startTime: item.startTime,
            endTime: item.endTime,
            status: "BROUILLON",
            planningVersion: 1,
          },
        });
        results.push(shift);
      }

      await tx.auditLog.create({
        data: {
          action: "MASTER_TEMPLATE_APPLIED",
          tableName: "Shift",
          recordId: "BATCH",
          userId: actor.id,
          payloadNew: { count: results.length, startDate: baseDate.toISOString() } as unknown as Prisma.InputJsonValue,
          timestamp: new Date(),
        },
      });

      return results;
    });

    return { success: true, data: created };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return { success: false, error: message };
  }
}

/**
 * Publication de la quinzaine.
 * Fait basculer les shifts de la période de 'BROUILLON' vers 'PUBLIE'
 * (ou 'EN_ATTENTE_DEROGATION' si le shift est prévu dans moins de 8 jours, J < 8).
 * RBAC : MANAGER ou SUPER_ADMIN.
 */
export async function publishQuinzaine(
  startDate: Date,
  endDate: Date
): Promise<ActionResult> {
  try {
    const actor = await requireUserWithRoles(["MANAGER", "SUPER_ADMIN"]);

    // Récupérer tous les shifts brouillons sur la plage
    const shiftsToPublish = await prisma.shift.findMany({
      where: {
        startTime: { gte: startDate, lte: endDate },
        status: "BROUILLON",
      },
    });

    if (shiftsToPublish.length === 0) {
      return {
        success: true,
        data: { publishedCount: 0, derogationCount: 0 },
      };
    }

    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      let publishedCount = 0;
      let derogationCount = 0;

      for (const shift of shiftsToPublish) {
        const noticeCheck = checkNoticePeriod(shift.startTime, now);
        const requiresDerogation = noticeCheck.requiresDerogation;
        const newStatus = requiresDerogation ? "EN_ATTENTE_DEROGATION" : "PUBLIE";

        if (requiresDerogation) derogationCount++;
        else publishedCount++;

        await tx.shift.update({
          where: { id: shift.id },
          data: {
            status: newStatus,
            isLateModification: requiresDerogation,
            derogationRequestedAt: requiresDerogation ? now : null,
            planningVersion: (shift.planningVersion || 1) + 1,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          action: "QUINZAINE_PUBLISHED",
          tableName: "Shift",
          recordId: "BATCH",
          userId: actor.id,
          payloadNew: {
            total: shiftsToPublish.length,
            publishedCount,
            derogationCount,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          } as unknown as Prisma.InputJsonValue,
          timestamp: now,
        },
      });

      return { publishedCount, derogationCount };
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
