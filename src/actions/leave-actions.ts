"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserWithRoles } from "@/lib/auth";
import { checkNoticePeriod } from "@/lib/hcr-rules";
import { leaveDate, leaveInterval } from "@/lib/leave-utils";
import { CreateLeaveSchema, ReviewLeaveSchema } from "@/schemas/leave";

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function refresh() {
  revalidatePath("/salarie/planning");
  revalidatePath("/manager/arbitrage");
  revalidatePath("/manager/planning");
}

export async function createLeaveRequest(input: unknown) {
  try {
    const user = await requireUserWithRoles(["SALARIE"]);
    const data = CreateLeaveSchema.parse(input);
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;
      const startDate = leaveDate(data.startDate);
      const endDate = leaveDate(data.endDate);
      const existing = await tx.leaveRequest.findFirst({
        where: { userId: user.id, status: { in: ["EN_ATTENTE", "APPROUVE"] }, startDate: { lte: endDate }, endDate: { gte: startDate } },
      });
      if (existing) throw new Error("Une demande existe déjà sur cette période.");
      const leave = await tx.leaveRequest.create({
        data: { userId: user.id, type: data.type, startDate, endDate, reason: data.reason || null },
      });
      await tx.auditLog.create({ data: {
        action: "LEAVE_REQUESTED", tableName: "LeaveRequest", recordId: leave.id,
        userId: user.id, payloadNew: json(leave),
      } });
      return leave;
    });
    refresh();
    return { success: true as const, data: result };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Erreur inattendue." };
  }
}

export async function reviewLeaveRequest(input: unknown) {
  try {
    const manager = await requireUserWithRoles(["MANAGER", "SUPER_ADMIN"]);
    const data = ReviewLeaveSchema.parse(input);
    const result = await prisma.$transaction(async (tx) => {
      const initial = await tx.leaveRequest.findUnique({ where: { id: data.id } });
      if (!initial) throw new Error("Demande introuvable.");
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${initial.userId} FOR UPDATE`;
      const leave = await tx.leaveRequest.findUniqueOrThrow({ where: { id: data.id } });
      if (leave.status !== "EN_ATTENTE") throw new Error("Cette demande a déjà été traitée.");
      const interval = leaveInterval(leave);
      const conflicts = data.approved ? await tx.shift.findMany({
        where: {
          userId: leave.userId, status: { not: "ANNULE" },
          startTime: { lt: interval.end }, endTime: { gt: interval.start },
        },
        orderBy: { startTime: "asc" },
      }) : [];
      if (conflicts.length && !data.forceReleaseShifts) {
        return { conflicts, leave: null };
      }
      if (conflicts.length && (data.confirmedShifts?.length !== conflicts.length ||
        conflicts.some((shift) => !data.confirmedShifts?.some((confirmed) => confirmed.id === shift.id && confirmed.planningVersion === shift.planningVersion)))) {
        return { conflicts, leave: null };
      }
      if (conflicts.some((shift) => shift.status === "EN_ATTENTE_DEROGATION")) {
        throw new Error("Résolvez d'abord les dérogations en attente sur les créneaux concernés.");
      }
      if (conflicts.length && await tx.timeEntry.findFirst({ where: { shiftId: { in: conflicts.map((shift) => shift.id) } } })) {
        throw new Error("Un créneau concerné possède déjà un pointage ; régularisez ce conflit avant de valider le congé.");
      }
      if (conflicts.some((shift) => shift.startTime <= new Date())) {
        throw new Error("Un créneau a déjà commencé ; régularisez ce conflit avant de valider le congé.");
      }
      if (conflicts.length && (await tx.shiftSwap.findFirst({ where: { shiftId: { in: conflicts.map((shift) => shift.id) }, status: { in: ["EN_ATTENTE_EQUIPIER", "EN_ATTENTE_MANAGER"] } } }) ||
        await tx.shiftReplacementRequest.findFirst({ where: { shiftId: { in: conflicts.map((shift) => shift.id) }, status: "EN_ATTENTE" } }))) {
        throw new Error("Un échange ou remplacement est en attente sur un créneau concerné.");
      }
      const settings = await tx.companySettings.findUnique({ where: { id: "default" } });
      for (const shift of conflicts) {
        const late = shift.status === "PUBLIE" &&
          checkNoticePeriod(shift.startTime, new Date(), settings?.noticeDelayDays ?? 8).requiresDerogation;
        const updated = await tx.shift.update({
          where: { id: shift.id },
          data: late ? {
            status: "EN_ATTENTE_DEROGATION", isLateModification: true,
            derogationRequestedAt: new Date(), derogationAcceptedAt: null, acknowledgedAt: null,
            planningVersion: shift.planningVersion + 1, leaveRequestId: leave.id, leaveAction: "RELEASE",
          } : { status: "ANNULE", planningVersion: shift.planningVersion + 1 },
        });
        await tx.auditLog.create({ data: {
          action: late ? "SHIFT_LEAVE_RELEASE_REQUESTED" : "SHIFT_RELEASED_FOR_LEAVE",
          tableName: "Shift", recordId: shift.id, userId: manager.id,
          payloadOld: json(shift), payloadNew: json({ shift: updated, leaveRequestId: leave.id }),
        } });
      }
      const updated = await tx.leaveRequest.update({
        where: { id: leave.id },
        data: { status: data.approved ? "APPROUVE" : "REFUSE", reviewedById: manager.id, reviewComment: data.comment || null },
      });
      await tx.auditLog.create({ data: {
        action: data.approved ? "LEAVE_APPROVED" : "LEAVE_REJECTED", tableName: "LeaveRequest",
        recordId: leave.id, userId: manager.id, payloadOld: json(leave), payloadNew: json(updated),
      } });
      return { conflicts: [], leave: updated };
    });
    refresh();
    return { success: true as const, data: result };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Erreur inattendue." };
  }
}
