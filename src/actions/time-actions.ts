"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireUserWithRoles } from "@/lib/auth";
import {
  ArbitrateTimeEntrySchema,
  type ArbitrateTimeEntryInput,
  MissedClockInSchema,
  type MissedClockInInput,
} from "@/schemas/validations";
import { roundClockOutTime } from "@/lib/hcr-rules";
import type { QualificationStatus, Prisma } from "@prisma/client";

export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string; fieldErrors?: Record<string, string[]> };

/**
 * Prise de poste effective du salarié.
 * Règle impérative : Horodatage système strict (new Date()) appliqué côté serveur.
 * Aucune heure injectée par le client n'est acceptée.
 */
export async function clockIn(input?: {
  userId?: string;
  shiftId?: string;
}): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "UNAUTHORIZED", code: "UNAUTHORIZED" };
    }

    // Règle de sécurité stricte : l'identité du salarié est déduite de la session serveur
    const targetUserId = input?.userId ?? user.id;

    // Un salarié ne peut pointer que pour lui-même
    if (user.role === "SALARIE" && targetUserId !== user.id) {
      return { success: false, error: "Accès refusé", code: "FORBIDDEN" };
    }

    // Horodatage système strict inviolable
    const serverClockInTime = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const entry = await tx.timeEntry.create({
        data: {
          userId: targetUserId,
          shiftId: input?.shiftId ?? null,
          clockInTime: serverClockInTime,
          qualification: "CONFORME",
        },
      });

      await tx.auditLog.create({
        data: {
          action: "CLOCK_IN",
          tableName: "TimeEntry",
          recordId: entry.id,
          userId: user.id,
          payloadNew: entry as unknown as Prisma.InputJsonValue,
          timestamp: serverClockInTime,
        },
      });

      return entry;
    });

    return { success: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return { success: false, error: message };
  }
}

/**
 * Fin de service effective du salarié.
 * Règles impératives :
 *  - Horodatage système strict (new Date()) appliqué côté serveur.
 *  - Calcul de l'arrondi standardisé au quart d'heure (15 min).
 *  - Enregistrement du motif en cas d'écart.
 */
export async function clockOut(input: {
  timeEntryId: string;
  discrepancyReason?: string;
}): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "UNAUTHORIZED", code: "UNAUTHORIZED" };
    }

    const currentEntry = await prisma.timeEntry.findUnique({
      where: { id: input.timeEntryId },
      include: { shift: true },
    });

    if (!currentEntry) {
      return { success: false, error: "Pointage introuvable", code: "NOT_FOUND" };
    }

    if (user.role === "SALARIE" && currentEntry.userId !== user.id) {
      return { success: false, error: "Accès refusé", code: "FORBIDDEN" };
    }

    // Horodatage système strict inviolable
    const serverClockOutTime = new Date();

    // Arrondi légal au quart d'heure standardisé (15 minutes en mode 'nearest')
    const roundedClockOut = roundClockOutTime(serverClockOutTime, 15, "nearest");

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.timeEntry.update({
        where: { id: input.timeEntryId },
        data: {
          rawClockOutTime: serverClockOutTime,
          roundedClockOutTime: roundedClockOut,
          discrepancyReason: input.discrepancyReason ?? null,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "CLOCK_OUT",
          tableName: "TimeEntry",
          recordId: updated.id,
          userId: user.id,
          payloadOld: currentEntry as unknown as Prisma.InputJsonValue,
          payloadNew: updated as unknown as Prisma.InputJsonValue,
          timestamp: serverClockOutTime,
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
 * Création d'imprévus sans pointage (Absence injustifiée, maladie, congés).
 * Règle impérative : Le salarié n'ayant pas déclenché de pointage, le manager
 * génère un TimeEntry à 0 heure (clockInTime = shift.startTime, clockOut = shift.startTime) tracé dans AuditLog.
 * RBAC : MANAGER ou SUPER_ADMIN.
 */
export async function recordOperationalStatus(
  shiftId: string,
  qualification: QualificationStatus,
  reason?: string
): Promise<ActionResult> {
  try {
    const manager = await requireUserWithRoles(["MANAGER", "SUPER_ADMIN"]);

    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
    });

    if (!shift) {
      return { success: false, error: "Shift introuvable", code: "NOT_FOUND" };
    }

    const timestamp = new Date();

    // TimeEntry à 0 heure (clockInTime = shift.startTime, rawClockOutTime = shift.startTime)
    const result = await prisma.$transaction(async (tx) => {
      const entry = await tx.timeEntry.create({
        data: {
          shiftId: shift.id,
          userId: shift.userId,
          clockInTime: shift.startTime,
          rawClockOutTime: shift.startTime,
          roundedClockOutTime: shift.startTime,
          qualification,
          discrepancyReason: reason ?? null,
          managerId: manager.id,
          arbitrationReason: reason ?? `Statut opérationnel: ${qualification}`,
          arbitratedAt: timestamp,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "OPERATIONAL_STATUS_RECORDED",
          tableName: "TimeEntry",
          recordId: entry.id,
          userId: manager.id,
          payloadNew: entry as unknown as Prisma.InputJsonValue,
          timestamp,
        },
      });

      return entry;
    });

    return { success: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return { success: false, error: message };
  }
}

/**
 * Régularisation d'un oubli de pointage avec saisie des heures effectives et motif obligatoire.
 * Règles impératives :
 *  - RBAC : MANAGER ou SUPER_ADMIN.
 *  - Anti-collision : Vérifie si un TimeEntry existe déjà pour ce shiftId afin d'éviter les erreurs de contrainte.
 *  - Si un pointage existe déjà, met à jour les champs de correction et de motif.
 *  - Arrondi automatique au quart d'heure sur l'heure de fin réelle.
 *  - Qualification : CONFORME si identique aux heures planifiées, sinon HEURES_MODIFIEES.
 *  - Enregistrement dans une transaction atomique avec AuditLog.
 */
export async function recordMissedClockIn(
  input: MissedClockInInput
): Promise<ActionResult> {
  try {
    const manager = await requireUserWithRoles(["MANAGER", "SUPER_ADMIN"]);
    const validated = MissedClockInSchema.parse(input);

    const shift = await prisma.shift.findUnique({
      where: { id: validated.shiftId },
    });

    if (!shift) {
      return { success: false, error: "Shift introuvable", code: "NOT_FOUND" };
    }

    const roundedClockOut = roundClockOutTime(validated.actualEndTime, 15, "nearest");

    const isConforme =
      validated.actualStartTime.getTime() === shift.startTime.getTime() &&
      validated.actualEndTime.getTime() === shift.endTime.getTime();

    const qualification: QualificationStatus = isConforme
      ? "CONFORME"
      : "HEURES_MODIFIEES";

    const timestamp = new Date();

    const result = await prisma.$transaction(async (tx) => {
      // Vérification anti-collision : existe-t-il déjà un TimeEntry lié à ce shift ?
      const existingEntry = await tx.timeEntry.findFirst({
        where: { shiftId: shift.id },
      });

      let entry;
      let action: string;

      if (existingEntry) {
        entry = await tx.timeEntry.update({
          where: { id: existingEntry.id },
          data: {
            clockInTime: existingEntry.clockInTime || validated.actualStartTime,
            rawClockOutTime: existingEntry.rawClockOutTime || validated.actualEndTime,
            roundedClockOutTime: existingEntry.roundedClockOutTime || roundedClockOut,
            correctedClockInTime: validated.actualStartTime,
            correctedClockOutTime: roundedClockOut,
            qualification,
            discrepancyReason: validated.reason.trim(),
            arbitrationReason: `Régularisation oubli de pointage : ${validated.reason.trim()}`,
            managerId: manager.id,
            arbitratedAt: timestamp,
          },
        });
        action = "MISSED_CLOCK_IN_UPDATED";
      } else {
        entry = await tx.timeEntry.create({
          data: {
            shiftId: shift.id,
            userId: shift.userId,
            clockInTime: validated.actualStartTime,
            rawClockOutTime: validated.actualEndTime,
            roundedClockOutTime: roundedClockOut,
            correctedClockInTime: validated.actualStartTime,
            correctedClockOutTime: roundedClockOut,
            qualification,
            discrepancyReason: validated.reason.trim(),
            arbitrationReason: `Régularisation oubli de pointage : ${validated.reason.trim()}`,
            managerId: manager.id,
            arbitratedAt: timestamp,
          },
        });
        action = "MISSED_CLOCK_IN_RECORDED";
      }

      await tx.auditLog.create({
        data: {
          action,
          tableName: "TimeEntry",
          recordId: entry.id,
          userId: manager.id,
          payloadOld: existingEntry as unknown as Prisma.InputJsonValue,
          payloadNew: entry as unknown as Prisma.InputJsonValue,
          timestamp,
        },
      });

      return entry;
    });

    return { success: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return { success: false, error: message };
  }
}

/**
 * Rectification managériale / Pouvoir d'arbitrage (prud'homal safe).
 * Règles impératives :
 *  - Ne jamais écraser la donnée brute initiale (clockInTime, rawClockOutTime restent intactes).
 *  - Enregistrer : correctedClockInTime, correctedClockOutTime, qualification, managerId, arbitrationReason, arbitratedAt.
 *  - Sauvegarder payloadOld et payloadNew dans AuditLog.
 * RBAC : MANAGER ou SUPER_ADMIN.
 */
export async function arbitrateTimeEntry(
  input: Omit<ArbitrateTimeEntryInput, "managerId"> & { managerId?: string }
): Promise<ActionResult> {
  try {
    const manager = await requireUserWithRoles(["MANAGER", "SUPER_ADMIN"]);
    const validated = ArbitrateTimeEntrySchema.parse({
      ...input,
      managerId: manager.id,
    });

    const currentEntry = await prisma.timeEntry.findUnique({
      where: { id: validated.timeEntryId },
    });

    if (!currentEntry) {
      return { success: false, error: "Pointage introuvable", code: "NOT_FOUND" };
    }

    const arbitrationTimestamp = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.timeEntry.update({
        where: { id: validated.timeEntryId },
        data: {
          correctedClockInTime: validated.correctedClockInTime,
          correctedClockOutTime: validated.correctedClockOutTime,
          qualification: validated.qualification,
          arbitrationReason: validated.arbitrationReason,
          managerId: manager.id,
          arbitratedAt: arbitrationTimestamp,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "TIME_ENTRY_ARBITRATED",
          tableName: "TimeEntry",
          recordId: updated.id,
          userId: manager.id,
          payloadOld: currentEntry as unknown as Prisma.InputJsonValue,
          payloadNew: updated as unknown as Prisma.InputJsonValue,
          timestamp: arbitrationTimestamp,
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
