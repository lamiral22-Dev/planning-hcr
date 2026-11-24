import { addDays, format, parseISO } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import type { Prisma, LeaveRequest } from "@prisma/client";
import { APP_TIMEZONE, toAppTime } from "./time-utils";
import { getFrenchPublicHolidays } from "./french-holidays";

export function leaveDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function leaveKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function countLeaveDays(start: string | Date, end: string | Date): number {
  const first = typeof start === "string" ? start : leaveKey(start);
  const last = typeof end === "string" ? end : leaveKey(end);
  if (last < first) return 0;
  let count = 0;
  const holidays = new Map<number, Set<string>>();
  for (let cursor = parseISO(first); format(cursor, "yyyy-MM-dd") <= last; cursor = addDays(cursor, 1)) {
    const key = format(cursor, "yyyy-MM-dd");
    const day = cursor.getDay();
    const year = cursor.getFullYear();
    if (!holidays.has(year)) holidays.set(year, new Set(getFrenchPublicHolidays(year).map((holiday) => holiday.date)));
    if (day !== 0 && !holidays.get(year)!.has(key)) count += 1;
  }
  return count;
}

export function accruedLeaveDays(hireDate: Date, asOf = leaveDate(format(toAppTime(new Date()), "yyyy-MM-dd"))): number {
  const hire = format(toAppTime(hireDate), "yyyy-MM-dd");
  const date = leaveKey(asOf);
  if (hire > date) return 0;
  const firstMonth = Number(hire.slice(0, 4)) * 12 + Number(hire.slice(5, 7)) - 1;
  const targetMonth = Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
  return Math.max(0, targetMonth - firstMonth + (hire.endsWith("-01") ? 1 : 0)) * 2.5;
}

export type LeaveBalanceEntry = { startDate: string; endDate: string };

export function remainingLeaveDays(hireDate: Date, adjustment: number, leaves: LeaveBalanceEntry[], asOf: string): number {
  const lastConsumedDate = format(addDays(parseISO(asOf), -1), "yyyy-MM-dd");
  const taken = leaves.filter((leave) => leave.startDate <= lastConsumedDate)
    .reduce((days, leave) => days + countLeaveDays(leave.startDate, leave.endDate < lastConsumedDate ? leave.endDate : lastConsumedDate), 0);
  return accruedLeaveDays(hireDate, leaveDate(asOf)) + adjustment - taken;
}

export function canReserveLeave(hireDate: Date, adjustment: number, leaves: LeaveBalanceEntry[], request: LeaveBalanceEntry): boolean {
  const days = countLeaveDays(request.startDate, request.endDate);
  if (days === 0 || remainingLeaveDays(hireDate, adjustment, leaves, request.startDate) < days) return false;
  return leaves.filter((leave) => leave.startDate > request.startDate)
    .every((leave) => remainingLeaveDays(hireDate, adjustment, leaves, leave.startDate) >= days + countLeaveDays(leave.startDate, leave.endDate));
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
