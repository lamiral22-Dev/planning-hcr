"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserWithRoles } from "@/lib/auth";
import { accruedLeaveDays, countLeaveDays, leaveDate, leaveInterval } from "@/lib/leave-utils";
import { CreateLeaveSchema, ReviewLeaveSchema } from "@/schemas/leave";

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function refresh() {
  revalidatePath("/salarie/planning");
  revalidatePath("/manager/arbitrage");
  revalidatePath("/manager/planning");
  revalidatePath("/manager/planning-salarie");
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
      if (data.type === "CP") {
        const [employee, approvedLeaves] = await Promise.all([
          tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { createdAt: true, cpAdjustment: true } }),
          tx.leaveRequest.findMany({ where: { userId: user.id, type: "CP", status: "APPROUVE" } }),
        ]);
        const taken = approvedLeaves.reduce((days, leave) => days + countLeaveDays(leave.startDate, leave.endDate), 0);
        const remaining = Math.max(0, accruedLeaveDays(employee.createdAt) + employee.cpAdjustment - taken);
        const requested = countLeaveDays(data.startDate, data.endDate);
        if (remaining <= 0 || remaining < requested) {
          throw new Error("Solde de CP insuffisant : la prise de CP anticipés n'est pas autorisée.");
        }
      }
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
      for (const shift of conflicts) {
        const updated = await tx.shift.update({
          where: { id: shift.id },
          data: {
            status: "ANNULE", planningVersion: shift.planningVersion + 1,
            leaveRequestId: leave.id, leaveAction: "RELEASE",
          },
        });
        await tx.auditLog.create({ data: {
          action: "SHIFT_RELEASED_FOR_LEAVE",
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
