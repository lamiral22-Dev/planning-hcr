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

function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function frenchPublicHolidays(year: number): Set<string> {
  const easter = easterSunday(year);
  const holidays = [
    new Date(Date.UTC(year, 0, 1)),
    new Date(Date.UTC(year, 4, 1)),
    new Date(Date.UTC(year, 4, 8)),
    new Date(Date.UTC(year, 6, 14)),
    new Date(Date.UTC(year, 7, 15)),
    new Date(Date.UTC(year, 10, 1)),
    new Date(Date.UTC(year, 10, 11)),
    new Date(Date.UTC(year, 11, 25)),
    addDays(easter, 1),
    addDays(easter, 39),
    addDays(easter, 50),
  ];
  return new Set(holidays.map((date) => format(date, "yyyy-MM-dd")));
}

export function countLeaveDays(start: string | Date, end: string | Date): number {
  const first = typeof start === "string" ? start : leaveKey(start);
  const last = typeof end === "string" ? end : leaveKey(end);
  if (last < first) return 0;
  let count = 0;
  for (let cursor = parseISO(first); format(cursor, "yyyy-MM-dd") <= last; cursor = addDays(cursor, 1)) {
    const key = format(cursor, "yyyy-MM-dd");
    const day = cursor.getDay();
    if (day !== 0 && !frenchPublicHolidays(cursor.getFullYear()).has(key)) count += 1;
  }
  return count;
}

export function accruedLeaveDays(hireDate: Date, asOf = new Date()): number {
  const hire = new Date(Date.UTC(hireDate.getUTCFullYear(), hireDate.getUTCMonth(), hireDate.getUTCDate()));
  const today = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
  if (hire > today) return 0;

  let total = 0;
  const month = new Date(Date.UTC(hire.getUTCFullYear(), hire.getUTCMonth(), 1));
  while (month.getTime() <= today.getTime()) {
    const monthStart = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0));
    if (monthEnd <= today) {
      const daysInMonth = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)).getUTCDate();
      const eligibleDays = monthStart.getTime() === new Date(Date.UTC(hire.getUTCFullYear(), hire.getUTCMonth(), 1)).getTime()
        ? daysInMonth - hire.getUTCDate() + 1
        : daysInMonth;
      total += 2.5 * eligibleDays / daysInMonth;
    }
    month.setUTCMonth(month.getUTCMonth() + 1);
  }
  return total;
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
