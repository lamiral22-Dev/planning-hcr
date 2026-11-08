"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireUserWithRoles } from "@/lib/auth";
import {
  SwapRequestSchema,
  PeerSwapResponseSchema,
  ManagerSwapApprovalSchema,
} from "@/schemas/validations";
import { validateShiftSwapEligibility } from "@/lib/hcr-rules";
import type { ShiftSwap, Shift, Prisma } from "@prisma/client";

export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

/**
 * Initiation d'une demande d'échange par l'équipier cédant.
 * Contrôles stricts :
 *  - Authentification serveur
 *  - Le shift appartient bien au demandeur
 *  - Le shift est au statut PUBLIE
 *  - Le destinataire est différent du demandeur
 *  - Aucun échange actif n'est déjà en cours sur ce shift
 */
export async function requestShiftSwap(input: {
  shiftId: string;
  targetUserId: string;
  reason?: string;
}): Promise<ActionResult<ShiftSwap>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "UNAUTHORIZED", code: "UNAUTHORIZED" };
    }

    const validated = SwapRequestSchema.parse({
      shiftId: input.shiftId,
      requesterId: user.id,
      targetUserId: input.targetUserId,
      reason: input.reason ?? null,
    });

    const shift = await prisma.shift.findUnique({
      where: { id: validated.shiftId },
    });

    if (!shift) {
      return { success: false, error: "Shift introuvable", code: "NOT_FOUND" };
    }

    if (shift.userId !== user.id) {
      return {
        success: false,
        error: "Vous n'êtes pas le titulaire de ce shift",
        code: "FORBIDDEN",
      };
    }

    if (shift.status !== "PUBLIE") {
      return {
        success: false,
        error: "Seul un shift au statut PUBLIE peut être proposé à l'échange",
        code: "INVALID_STATUS",
      };
    }

    // Vérifier l'existence d'une demande en cours
    const existingActiveSwap = await prisma.shiftSwap.findFirst({
      where: {
        shiftId: validated.shiftId,
        status: { in: ["EN_ATTENTE_EQUIPIER", "EN_ATTENTE_MANAGER"] },
      },
    });

    if (existingActiveSwap) {
      return {
        success: false,
        error: "Une demande d'échange est déjà en cours pour ce créneau",
        code: "SWAP_ALREADY_IN_PROGRESS",
      };
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: validated.targetUserId },
    });

    if (!targetUser) {
      return {
        success: false,
        error: "Le salarié repreneur ciblé est introuvable",
        code: "TARGET_USER_NOT_FOUND",
      };
    }

    const result = await prisma.$transaction(async (tx) => {
      const swap = await tx.shiftSwap.create({
        data: {
          shiftId: validated.shiftId,
          requesterId: user.id,
          targetUserId: validated.targetUserId,
          reason: validated.reason,
          status: "EN_ATTENTE_EQUIPIER",
        },
      });

      await tx.auditLog.create({
        data: {
          action: "SWAP_REQUESTED",
          tableName: "ShiftSwap",
          recordId: swap.id,
          userId: user.id,
          payloadNew: swap as unknown as Prisma.InputJsonValue,
          timestamp: new Date(),
        },
      });

      return swap;
    });

    return { success: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return { success: false, error: message };
  }
}

/**
 * Réponse de l'équipier repreneur sollicité (Acceptation ou Refus).
 * En cas d'acceptation :
 *  - Contrôle d'absence de collision / chevauchement direct
 *  - Contrôle de conformité légale HCR temps réel (11h repos, 48h hebdo, 2 jours repos hebdo)
 *  - Si conforme -> bascule au statut EN_ATTENTE_MANAGER
 */
export async function respondToSwapRequest(input: {
  swapId: string;
  accepted: boolean;
  rejectedReason?: string;
}): Promise<ActionResult<ShiftSwap>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "UNAUTHORIZED", code: "UNAUTHORIZED" };
    }

    const validated = PeerSwapResponseSchema.parse(input);

    const swap = await prisma.shiftSwap.findUnique({
      where: { id: validated.swapId },
      include: { shift: true },
    });

    if (!swap) {
      return { success: false, error: "Demande d'échange introuvable", code: "NOT_FOUND" };
    }

    if (swap.targetUserId !== user.id) {
      return {
        success: false,
        error: "Vous n'êtes pas le destinataire de cette demande",
        code: "FORBIDDEN",
      };
    }

    if (swap.status !== "EN_ATTENTE_EQUIPIER") {
      return {
        success: false,
        error: "La demande d'échange n'est plus en attente d'équipier",
        code: "INVALID_STATUS",
      };
    }

    const timestamp = new Date();

    // Cas du refus par l'équipier
    if (!validated.accepted) {
      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.shiftSwap.update({
          where: { id: swap.id },
          data: {
            status: "REFUSE",
            rejectedReason: validated.rejectedReason ?? "Refusé par l'équipier",
          },
        });

        await tx.auditLog.create({
          data: {
            action: "SWAP_REJECTED_BY_PEER",
            tableName: "ShiftSwap",
            recordId: swap.id,
            userId: user.id,
            payloadOld: swap as unknown as Prisma.InputJsonValue,
            payloadNew: updated as unknown as Prisma.InputJsonValue,
            timestamp,
          },
        });

        return updated;
      });

      return { success: true, data: result };
    }

    // Cas de l'acceptation : Récupération des shifts existants du repreneur
    const targetUserShifts = await prisma.shift.findMany({
      where: {
        userId: user.id,
        status: { not: "ANNULE" },
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
      },
    });

    // 1. Contrôle strict d'absence de collision / chevauchement direct
    // collision si (!(existingEnd <= shiftStart || existingStart >= shiftEnd))
    const shiftToTake = {
      id: swap.shift.id,
      startTime: swap.shift.startTime,
      endTime: swap.shift.endTime,
    };

    const hasCollision = targetUserShifts.some(
      (existing) =>
        !(
          existing.endTime <= shiftToTake.startTime ||
          existing.startTime >= shiftToTake.endTime
        )
    );

    if (hasCollision) {
      return {
        success: false,
        error: "Le créneau à reprendre chevauche directement l'un de vos shifts existants.",
        code: "SHIFT_COLLISION",
      };
    }

    // 2. Contrôle de conformité légale HCR en temps réel via validateShiftSwapEligibility
    const eligibility = validateShiftSwapEligibility(targetUserShifts, shiftToTake);
    if (!eligibility.isEligible) {
      return {
        success: false,
        error: `Incompatibilité légale HCR : ${eligibility.errors.join(" ")}`,
        code: "HCR_COMPLIANCE_VIOLATION",
      };
    }

    // Si conforme : passage à EN_ATTENTE_MANAGER
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.shiftSwap.update({
        where: { id: swap.id },
        data: {
          status: "EN_ATTENTE_MANAGER",
          peerApprovedAt: timestamp,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "SWAP_ACCEPTED_BY_PEER",
          tableName: "ShiftSwap",
          recordId: swap.id,
          userId: user.id,
          payloadOld: swap as unknown as Prisma.InputJsonValue,
          payloadNew: updated as unknown as Prisma.InputJsonValue,
          timestamp,
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
 * Arbitrage final par le Manager (Validation ou Refus).
 * En cas de validation :
 *  - Transaction atomique Prisma :
 *      * Réassignation du shift au salarié repreneur (userId = targetUserId)
 *      * Réinitialisation explicite de acknowledgedAt: null (le repreneur doit émarger son nouveau shift)
 *      * Mise à jour du swap : status = VALIDE, managerApprovedAt = new Date()
 *      * Journalisation AuditLog (action: "SWAP_APPROVED_BY_MANAGER")
 */
export async function arbitrateShiftSwap(input: {
  swapId: string;
  approved: boolean;
  rejectedReason?: string;
}): Promise<ActionResult<{ swap: ShiftSwap; shift: Shift }>> {
  try {
    const manager = await requireUserWithRoles(["MANAGER", "SUPER_ADMIN"]);
    const validated = ManagerSwapApprovalSchema.parse({
      swapId: input.swapId,
      managerId: manager.id,
      approved: input.approved,
      rejectedReason: input.rejectedReason,
    });

    const swap = await prisma.shiftSwap.findUnique({
      where: { id: validated.swapId },
      include: { shift: true },
    });

    if (!swap) {
      return { success: false, error: "Demande d'échange introuvable", code: "NOT_FOUND" };
    }

    if (swap.status !== "EN_ATTENTE_MANAGER") {
      return {
        success: false,
        error: "Le swap n'est pas en attente de validation managériale",
        code: "INVALID_STATUS",
      };
    }

    const timestamp = new Date();

    // Cas du refus par le manager
    if (!validated.approved) {
      const result = await prisma.$transaction(async (tx) => {
        const updatedSwap = await tx.shiftSwap.update({
          where: { id: swap.id },
          data: {
            status: "REFUSE",
            rejectedReason: validated.rejectedReason ?? "Refusé par la direction",
          },
        });

        await tx.auditLog.create({
          data: {
            action: "SWAP_REJECTED_BY_MANAGER",
            tableName: "ShiftSwap",
            recordId: swap.id,
            userId: manager.id,
            payloadOld: swap as unknown as Prisma.InputJsonValue,
            payloadNew: updatedSwap as unknown as Prisma.InputJsonValue,
            timestamp,
          },
        });

        return { swap: updatedSwap, shift: swap.shift };
      });

      return { success: true, data: result };
    }

    // Cas de la validation par le manager
    // Transaction atomique : Re-vérification HCR + Transfert shift + Reset émargement + Audit
    const result = await prisma.$transaction(async (tx) => {
      // Re-vérification de collision / HCR pour le targetUser
      const targetUserShifts = await tx.shift.findMany({
        where: {
          userId: swap.targetUserId,
          status: { not: "ANNULE" },
        },
        select: {
          id: true,
          startTime: true,
          endTime: true,
        },
      });

      const shiftToTake = {
        id: swap.shift.id,
        startTime: swap.shift.startTime,
        endTime: swap.shift.endTime,
      };

      const hasCollision = targetUserShifts.some(
        (existing) =>
          !(
            existing.endTime <= shiftToTake.startTime ||
            existing.startTime >= shiftToTake.endTime
          )
      );

      if (hasCollision) {
        throw new Error(
          "COLLISION: Le créneau à reprendre chevauche un shift existant du repreneur."
        );
      }

      const eligibility = validateShiftSwapEligibility(targetUserShifts, shiftToTake);
      if (!eligibility.isEligible) {
        throw new Error(`HCR_VIOLATION: ${eligibility.errors.join(" ")}`);
      }

      // Réassignation du shift au repreneur et réinitialisation de l'émargement
      const updatedShift = await tx.shift.update({
        where: { id: swap.shiftId },
        data: {
          userId: swap.targetUserId,
          acknowledgedAt: null, // Règle métier : le repreneur doit émarger son nouveau shift
          planningVersion: (swap.shift.planningVersion || 1) + 1,
        },
      });

      const updatedSwap = await tx.shiftSwap.update({
        where: { id: swap.id },
        data: {
          status: "VALIDE",
          managerApprovedAt: timestamp,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "SWAP_APPROVED_BY_MANAGER",
          tableName: "ShiftSwap",
          recordId: swap.id,
          userId: manager.id,
          payloadOld: {
            swapStatus: swap.status,
            previousUserId: swap.shift.userId,
            acknowledgedAt: swap.shift.acknowledgedAt,
          },
          payloadNew: {
            swapStatus: "VALIDE",
            newUserId: swap.targetUserId,
            acknowledgedAt: null,
          },
          timestamp,
        },
      });

      return { swap: updatedSwap, shift: updatedShift };
    });

    return { success: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return { success: false, error: message };
  }
}
