import { addDays, format, parseISO } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { Prisma, type LeaveRequest } from "@prisma/client";
import { APP_TIMEZONE, toAppTime } from "./time-utils";

export function leaveDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function leaveKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function shiftLeaveDays(start: Date, end: Date): { first: string; last: string } {
  return {
    first: format(toAppTime(start), "yyyy-MM-dd"),
    last: format(toAppTime(new Date(end.getTime() - 1)), "yyyy-MM-dd"),
  };
}

export function leaveInterval(leave: Pick<LeaveRequest, "startDate" | "endDate">) {
  const first = leaveKey(leave.startDate);
  const next = format(addDays(parseISO(leaveKey(leave.endDate)), 1), "yyyy-MM-dd");
  return {
    start: fromZonedTime(`${first}T00:00:00`, APP_TIMEZONE),
    end: fromZonedTime(`${next}T00:00:00`, APP_TIMEZONE),
  };
}

export async function conflictingLeaves(tx: Prisma.TransactionClient, userId: string, start: Date, end: Date) {
  const { first, last } = shiftLeaveDays(start, end);
  return tx.leaveRequest.findMany({
    where: { userId, status: "APPROUVE", startDate: { lte: leaveDate(last) }, endDate: { gte: leaveDate(first) } },
  });
}

export async function removeLeaveDays(
  tx: Prisma.TransactionClient,
  leave: LeaveRequest,
  first: string,
  last: string,
  actorId: string,
  shiftId: string,
) {
  const start = leaveKey(leave.startDate);
  const end = leaveKey(leave.endDate);
  const before = first > start ? format(addDays(parseISO(first), -1), "yyyy-MM-dd") : null;
  const after = last < end ? format(addDays(parseISO(last), 1), "yyyy-MM-dd") : null;
  const data = before
    ? { endDate: leaveDate(before) }
    : after ? { startDate: leaveDate(after) } : { status: "ANNULE" };
  const updated = await tx.leaveRequest.update({ where: { id: leave.id }, data });
  let remainder: LeaveRequest | null = null;
  if (before && after) {
    remainder = await tx.leaveRequest.create({
      data: {
        userId: leave.userId, type: leave.type, startDate: leaveDate(after),
        endDate: leave.endDate, reason: leave.reason, status: leave.status,
        reviewedById: leave.reviewedById, reviewComment: leave.reviewComment,
      },
    });
  }
  await tx.auditLog.create({
    data: {
      action: "LEAVE_OVERRIDDEN", tableName: "LeaveRequest", recordId: leave.id, userId: actorId,
      payloadOld: JSON.parse(JSON.stringify(leave)) as Prisma.InputJsonValue,
      payloadNew: JSON.parse(JSON.stringify({ leave: updated, remainder, first, last, shiftId })) as Prisma.InputJsonValue,
    },
  });
}
