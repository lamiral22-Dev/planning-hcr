import { addDays, format, isValid, parse, startOfMonth, startOfWeek, subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { PlanningRestaurantView } from "@/components/features/manager/planning/planning-restaurant-view";
import { fromAppTime, toAppTime } from "@/lib/time-utils";
import { countLeaveDays, leaveKey, remainingLeaveDays } from "@/lib/leave-utils";

export const dynamic = "force-dynamic";

export default async function ManagerPlanningPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week } = await searchParams;
  const parsed = week ? parse(week, "yyyy-MM-dd", new Date()) : null;
  const selected = parsed && isValid(parsed) && format(parsed, "yyyy-MM-dd") === week
    ? parsed : toAppTime(new Date());
  const currentWeek = startOfWeek(selected, { weekStartsOn: 1 });
  const sunday = addDays(currentWeek, 6);
  const rangeStart = subDays(currentWeek, 7);
  const monthStart = startOfMonth(sunday);
  const start = fromAppTime(monthStart < rangeStart ? monthStart : rangeStart);
  const end = fromAppTime(addDays(currentWeek, 14));
  const [employees, slots, shifts, closures, leaves, approvedCpLeaves] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ["SALARIE", "MANAGER"] }, isActive: true },
      select: { id: true, firstName: true, lastName: true, createdAt: true, cpAdjustment: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.restaurantSlot.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.shift.findMany({
      where: {
        startTime: { lt: end },
        endTime: { gt: start },
        status: { not: "ANNULE" },
      },
      include: {
        replacementRequests: {
          where: { status: "EN_ATTENTE" },
          include: { proposedUser: { select: { firstName: true, lastName: true } } },
        },
      },
      orderBy: { startTime: "asc" },
    }),
    prisma.restaurantClosure.findMany({
      where: { date: { gte: new Date(`${format(currentWeek, "yyyy-MM-dd")}T00:00:00Z`), lt: new Date(`${format(addDays(currentWeek, 7), "yyyy-MM-dd")}T00:00:00Z`) } },
      select: { slotId: true, date: true, isClosed: true },
    }),
    prisma.leaveRequest.findMany({
      where: { status: { in: ["APPROUVE", "EN_ATTENTE"] }, startDate: { lte: new Date(`${format(sunday, "yyyy-MM-dd")}T00:00:00Z`) }, endDate: { gte: new Date(`${format(currentWeek, "yyyy-MM-dd")}T00:00:00Z`) } },
      include: { user: { select: { firstName: true, lastName: true } } },
    }),
    prisma.leaveRequest.findMany({
      where: { type: "CP", status: "APPROUVE" },
      select: { userId: true, startDate: true, endDate: true, dayPeriod: true },
    }),
  ]);

  const leavesByEmployee = new Map<string, { startDate: string; endDate: string; dayPeriod: string }[]>();
  for (const leave of approvedCpLeaves) {
    const entries = leavesByEmployee.get(leave.userId) ?? [];
    entries.push({ startDate: leaveKey(leave.startDate), endDate: leaveKey(leave.endDate), dayPeriod: leave.dayPeriod });
    leavesByEmployee.set(leave.userId, entries);
  }
  const balanceDate = format(currentWeek, "yyyy-MM-dd");
  return (
    <PlanningRestaurantView
      weekStart={format(currentWeek, "yyyy-MM-dd")}
      employees={employees.map((employee) => ({
        id: employee.id,
        name: `${employee.firstName} ${employee.lastName}`,
        cpTakenDays: (leavesByEmployee.get(employee.id) ?? []).filter((leave) => leave.startDate <= balanceDate)
          .reduce((days, leave) => days + countLeaveDays(leave.startDate, leave.endDate, leave.dayPeriod), 0),
        cpRemainingDays: Math.max(0, remainingLeaveDays(employee.createdAt, employee.cpAdjustment, leavesByEmployee.get(employee.id) ?? [], balanceDate)),
      }))}
      slots={slots}
      shifts={shifts.map((shift) => ({
        id: shift.id,
        slotId: shift.slotId,
        userId: shift.userId,
        startTime: shift.startTime.toISOString(),
        endTime: shift.endTime.toISOString(),
        status: shift.status,
        isLateModification: shift.isLateModification,
        derogationAcceptedAt: shift.derogationAcceptedAt?.toISOString() ?? null,
        pendingReplacements: shift.replacementRequests.map((request) => ({
          id: request.id,
          proposedUserName: `${request.proposedUser.firstName} ${request.proposedUser.lastName}`,
        })),
      }))}
      closures={closures.map((closure) => ({
        slotId: closure.slotId,
        date: closure.date.toISOString().slice(0, 10),
        closed: closure.isClosed,
      }))}
      leaves={leaves.map((leave) => ({
        id: leave.id, userId: leave.userId, type: leave.type, status: leave.status, dayPeriod: leave.dayPeriod,
        name: `${leave.user.firstName} ${leave.user.lastName}`,
        startDate: leave.startDate.toISOString().slice(0, 10), endDate: leave.endDate.toISOString().slice(0, 10),
      }))}
    />
  );
}
