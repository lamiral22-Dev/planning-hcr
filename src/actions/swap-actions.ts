"use server";

import { prisma } from "@/lib/prisma";
import { conflictingLeaves } from "@/lib/leave-utils";
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

async function lockSwapShift(tx: Prisma.TransactionClient, shiftId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`shift-swap:${shiftId}`}, 0))`;
  await tx.$queryRaw`SELECT id FROM "Shift" WHERE id = ${shiftId} FOR UPDATE`;
}

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

    const result = await prisma.$transaction(async (tx) => {
      await lockSwapShift(tx, validated.shiftId);
      const shift = await tx.shift.findUnique({ where: { id: validated.shiftId } });
      if (!shift) {
        return { success: false as const, error: "Shift introuvable", code: "NOT_FOUND" };
      }
      if (shift.userId !== user.id) {
        return { success: false as const, error: "Vous n'êtes pas le titulaire de ce shift", code: "FORBIDDEN" };
      }
      if (shift.status !== "PUBLIE" || shift.leaveAction) {
        return { success: false as const, error: "Seul un shift au statut PUBLIE peut être proposé à l'échange", code: "INVALID_STATUS" };
      }
      const existingActiveSwap = await tx.shiftSwap.findFirst({
        where: {
          shiftId: validated.shiftId,
          status: { in: ["EN_ATTENTE_EQUIPIER", "EN_ATTENTE_MANAGER"] },
        },
      });
      if (existingActiveSwap) {
        return { success: false as const, error: "Une demande d'échange est déjà en cours pour ce créneau", code: "SWAP_ALREADY_IN_PROGRESS" };
      }
      const targetUser = await tx.user.findUnique({ where: { id: validated.targetUserId } });
      if (!targetUser) {
        return { success: false as const, error: "Le salarié repreneur ciblé est introuvable", code: "TARGET_USER_NOT_FOUND" };
      }

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

      return { success: true as const, data: swap };
    });

    return result;
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

    const initialSwap = await prisma.shiftSwap.findUnique({
      where: { id: validated.swapId },
      select: { id: true, shiftId: true },
    });

    if (!initialSwap) {
      return { success: false, error: "Demande d'échange introuvable", code: "NOT_FOUND" };
    }

    const timestamp = new Date();
    const result = await prisma.$transaction(async (tx) => {
      await lockSwapShift(tx, initialSwap.shiftId);
      const swap = await tx.shiftSwap.findUnique({
        where: { id: validated.swapId },
        include: { shift: true },
      });
      if (!swap) return { success: false as const, error: "Demande d'échange introuvable", code: "NOT_FOUND" };
      if (swap.targetUserId !== user.id) {
        return { success: false as const, error: "Vous n'êtes pas le destinataire de cette demande", code: "FORBIDDEN" };
      }
      if (swap.status !== "EN_ATTENTE_EQUIPIER") {
        return { success: false as const, error: "La demande d'échange n'est plus en attente d'équipier", code: "INVALID_STATUS" };
      }
      if (validated.accepted && (
        swap.shift.userId !== swap.requesterId ||
        swap.shift.status !== "PUBLIE" ||
        swap.shift.leaveAction
      )) {
        return { success: false as const, error: "Le créneau a changé ou attend une décision liée à un congé.", code: "INVALID_STATUS" };
      }

      if (validated.accepted) {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;
        if ((await conflictingLeaves(tx, user.id, swap.shift.startTime, swap.shift.endTime)).length) {
          return { success: false as const, error: "Un congé validé couvre ce créneau.", code: "HCR_COMPLIANCE_VIOLATION" };
        }
        const targetUserShifts = await tx.shift.findMany({
          where: { userId: user.id, status: { not: "ANNULE" } },
          select: { id: true, startTime: true, endTime: true },
        });
        const shiftToTake = { id: swap.shift.id, startTime: swap.shift.startTime, endTime: swap.shift.endTime };
        const hasCollision = targetUserShifts.some(
          (existing) => !(existing.endTime <= shiftToTake.startTime || existing.startTime >= shiftToTake.endTime)
        );
        if (hasCollision) {
          return { success: false as const, error: "Le créneau à reprendre chevauche directement l'un de vos shifts existants.", code: "SHIFT_COLLISION" };
        }
        const eligibility = validateShiftSwapEligibility(targetUserShifts, shiftToTake);
        if (!eligibility.isEligible) {
          return { success: false as const, error: `Incompatibilité légale HCR : ${eligibility.errors.join(" ")}`, code: "HCR_COMPLIANCE_VIOLATION" };
        }
      }

      const rejected = !validated.accepted;
      const updated = await tx.shiftSwap.update({
        where: { id: swap.id },
        data: rejected
          ? { status: "REFUSE", rejectedReason: validated.rejectedReason ?? "Refusé par l'équipier" }
          : { status: "EN_ATTENTE_MANAGER", peerApprovedAt: timestamp },
      });
      await tx.auditLog.create({
        data: {
          action: rejected ? "SWAP_REJECTED_BY_PEER" : "SWAP_ACCEPTED_BY_PEER",
          tableName: "ShiftSwap",
          recordId: swap.id,
          userId: user.id,
          payloadOld: swap as unknown as Prisma.InputJsonValue,
          payloadNew: updated as unknown as Prisma.InputJsonValue,
          timestamp,
        },
      });

      return { success: true as const, data: updated };
    });

    return result;
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

    const initialSwap = await prisma.shiftSwap.findUnique({
      where: { id: validated.swapId },
      select: { id: true, shiftId: true },
    });

    if (!initialSwap) {
      return { success: false, error: "Demande d'échange introuvable", code: "NOT_FOUND" };
    }

    const timestamp = new Date();

    const result = await prisma.$transaction(async (tx) => {
      await lockSwapShift(tx, initialSwap.shiftId);
      const swap = await tx.shiftSwap.findUnique({
        where: { id: validated.swapId },
        include: { shift: true },
      });
      if (!swap) {
        return { success: false as const, error: "Demande d'échange introuvable", code: "NOT_FOUND" };
      }
      if (swap.status !== "EN_ATTENTE_MANAGER") {
        return { success: false as const, error: "Le swap n'est pas en attente de validation managériale", code: "INVALID_STATUS" };
      }
      if (validated.approved && (
        swap.shift.leaveAction ||
        swap.shift.status !== "PUBLIE" ||
        swap.shift.userId !== swap.requesterId
      )) {
        return { success: false as const, error: "Le créneau a changé ou attend une décision liée à un congé.", code: "INVALID_STATUS" };
      }

      if (validated.approved) {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${swap.targetUserId} FOR UPDATE`;
        if ((await conflictingLeaves(tx, swap.targetUserId, swap.shift.startTime, swap.shift.endTime)).length) {
          return { success: false as const, error: "Un congé validé couvre ce créneau.", code: "HCR_COMPLIANCE_VIOLATION" };
        }
        const targetUserShifts = await tx.shift.findMany({
          where: { userId: swap.targetUserId, status: { not: "ANNULE" } },
          select: { id: true, startTime: true, endTime: true },
        });
        const shiftToTake = { id: swap.shift.id, startTime: swap.shift.startTime, endTime: swap.shift.endTime };
        const hasCollision = targetUserShifts.some(
          (existing) => !(existing.endTime <= shiftToTake.startTime || existing.startTime >= shiftToTake.endTime)
        );
        if (hasCollision) {
          return { success: false as const, error: "COLLISION: Le créneau à reprendre chevauche un shift existant du repreneur.", code: "SHIFT_COLLISION" };
        }
        const eligibility = validateShiftSwapEligibility(targetUserShifts, shiftToTake);
        if (!eligibility.isEligible) {
          return { success: false as const, error: `HCR_VIOLATION: ${eligibility.errors.join(" ")}`, code: "HCR_COMPLIANCE_VIOLATION" };
        }
      }

      const updatedSwap = await tx.shiftSwap.update({
        where: { id: swap.id },
        data: validated.approved
          ? { status: "VALIDE", managerApprovedAt: timestamp }
          : { status: "REFUSE", rejectedReason: validated.rejectedReason ?? "Refusé par la direction" },
      });
      const updatedShift = validated.approved
        ? await tx.shift.update({
            where: { id: swap.shiftId },
            data: {
              userId: swap.targetUserId,
              acknowledgedAt: null,
              planningVersion: (swap.shift.planningVersion || 1) + 1,
            },
          })
        : swap.shift;
      await tx.auditLog.create({
        data: {
          action: validated.approved ? "SWAP_APPROVED_BY_MANAGER" : "SWAP_REJECTED_BY_MANAGER",
          tableName: "ShiftSwap",
          recordId: swap.id,
          userId: manager.id,
          payloadOld: validated.approved
            ? {
                swapStatus: swap.status,
                previousUserId: swap.shift.userId,
                acknowledgedAt: swap.shift.acknowledgedAt,
              }
            : swap as unknown as Prisma.InputJsonValue,
          payloadNew: validated.approved
            ? { swapStatus: "VALIDE", newUserId: swap.targetUserId, acknowledgedAt: null }
            : updatedSwap as unknown as Prisma.InputJsonValue,
          timestamp,
        },
      });

      return { success: true as const, data: { swap: updatedSwap, shift: updatedShift } };
    });

    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return { success: false, error: message };
  }
}
