import { addDays, format, isValid, parse, startOfMonth, startOfWeek, subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { PlanningRestaurantView } from "@/components/features/manager/planning/planning-restaurant-view";
import { fromAppTime, toAppTime } from "@/lib/time-utils";

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
  const [employees, slots, shifts, closures] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ["SALARIE", "MANAGER"] }, isActive: true },
      select: { id: true, firstName: true, lastName: true },
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
  ]);

  return (
    <PlanningRestaurantView
      weekStart={format(currentWeek, "yyyy-MM-dd")}
      employees={employees.map((employee) => ({
        id: employee.id,
        name: `${employee.firstName} ${employee.lastName}`,
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
    />
  );
}
