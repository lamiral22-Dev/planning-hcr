import { addWeeks, startOfWeek } from "date-fns";
import { prisma } from "@/lib/prisma";
import { PlanningRestaurantView } from "@/components/features/manager/planning/planning-restaurant-view";
import { fromAppTime, toAppTime } from "@/lib/time-utils";

export const dynamic = "force-dynamic";

export default async function ManagerPlanningPage() {
  const currentWeek = startOfWeek(toAppTime(new Date()), { weekStartsOn: 1 });
  const start = fromAppTime(addWeeks(currentWeek, -30));
  const end = fromAppTime(addWeeks(currentWeek, 27));
  const [employees, slots, shifts, closures] = await Promise.all([
    prisma.user.findMany({
      where: { role: "SALARIE", isActive: true },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.restaurantSlot.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.shift.findMany({
      where: {
        slotId: { not: null },
        startTime: { gte: start, lt: end },
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
      where: { date: { gte: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())), lt: new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())) } },
      select: { slotId: true, date: true, isClosed: true },
    }),
  ]);

  return (
    <PlanningRestaurantView
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
