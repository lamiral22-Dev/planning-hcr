import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { SalariePlanningView } from "@/components/features/salarie/planning/salarie-planning-view";
import { redirect } from "next/navigation";
import { accruedLeaveDays, countLeaveDays } from "@/lib/leave-utils";

export default async function SalariePlanningPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Récupération des shifts du salarié
  const [shifts, replacementRequests, leaves, approvedCpLeaves, employee] = await Promise.all([
    prisma.shift.findMany({
    where: {
      userId: user.id,
      status: { in: ["PUBLIE", "EN_ATTENTE_DEROGATION"] },
    },
    orderBy: {
      startTime: "asc",
    },
    }),
    prisma.shiftReplacementRequest.findMany({
      where: { shift: { userId: user.id }, status: "EN_ATTENTE" },
      include: {
        proposedUser: { select: { firstName: true, lastName: true } },
        shift: { select: { startTime: true, endTime: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.leaveRequest.findMany({
      where: { userId: user.id, status: { in: ["EN_ATTENTE", "APPROUVE"] } },
      orderBy: { startDate: "asc" },
    }),
    prisma.leaveRequest.findMany({
      where: { userId: user.id, type: "CP", status: "APPROUVE" },
      select: { startDate: true, endDate: true },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { createdAt: true, cpAdjustment: true },
    }),
  ]);

  // Recherche d'un pointage en cours
  const activeTimeEntry = await prisma.timeEntry.findFirst({
    where: {
      userId: user.id,
      rawClockOutTime: null,
    },
    orderBy: {
      clockInTime: "desc",
    },
  });

  return (
    <SalariePlanningView
      shifts={shifts.map((s) => ({
        id: s.id,
        startTime: s.startTime,
        endTime: s.endTime,
        status: s.status,
        isLateModification: s.isLateModification,
        acknowledgedAt: s.acknowledgedAt,
        derogationAcceptedAt: s.derogationAcceptedAt,
        planningVersion: s.planningVersion,
        leaveAction: s.leaveAction,
      }))}
      leaves={leaves.map((leave) => ({
        id: leave.id, type: leave.type, status: leave.status,
        startDate: leave.startDate.toISOString().slice(0, 10),
        endDate: leave.endDate.toISOString().slice(0, 10),
      }))}
      cpRemainingDays={Math.max(
        0,
        accruedLeaveDays(employee.createdAt) + employee.cpAdjustment -
          approvedCpLeaves.reduce((days, leave) => days + countLeaveDays(leave.startDate, leave.endDate), 0),
      )}
      activeTimeEntryId={activeTimeEntry?.id ?? null}
      activeClockInTime={activeTimeEntry?.clockInTime ?? null}
      replacementRequests={replacementRequests.map((request) => ({
        id: request.id,
        proposedEmployee: `${request.proposedUser.firstName} ${request.proposedUser.lastName}`,
        startTime: request.shift.startTime,
        endTime: request.shift.endTime,
      }))}
    />
  );
}
