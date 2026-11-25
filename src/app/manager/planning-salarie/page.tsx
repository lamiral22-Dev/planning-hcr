import { prisma } from "@/lib/prisma";
import { PlanningQuinzaineView } from "@/components/features/manager/planning/planning-quinzaine-view";

export const dynamic = "force-dynamic";

export default async function ManagerEmployeePlanningPage() {
  const [employees, shifts, leaves] = await Promise.all([
    prisma.user.findMany({
      where: { role: "SALARIE" },
      select: { id: true, firstName: true, lastName: true, isActive: true },
      orderBy: [{ isActive: "desc" }, { lastName: "asc" }],
    }),
    prisma.shift.findMany({
      where: { status: { not: "ANNULE" } },
      select: { id: true, userId: true, startTime: true, endTime: true, status: true, isLateModification: true },
      orderBy: { startTime: "asc" },
    }),
    prisma.leaveRequest.findMany({
      where: { status: { in: ["EN_ATTENTE", "APPROUVE"] } },
      select: { id: true, userId: true, type: true, status: true, startDate: true, endDate: true, dayPeriod: true },
      orderBy: { startDate: "asc" },
    }),
  ]);

  return (
    <PlanningQuinzaineView
      readOnly
      employees={employees.map((employee) => ({
        id: employee.id,
        name: `${employee.firstName} ${employee.lastName}`,
        role: "Salarié HCR",
        isActive: employee.isActive,
      }))}
      initialShifts={shifts.map((shift) => ({
        ...shift,
        startTime: shift.startTime.toISOString(),
        endTime: shift.endTime.toISOString(),
      }))}
      leaves={leaves.map((leave) => ({
        ...leave,
        startDate: leave.startDate.toISOString().slice(0, 10),
        endDate: leave.endDate.toISOString().slice(0, 10),
      }))}
    />
  );
}
