import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { SalariePlanningView } from "@/components/features/salarie/planning/salarie-planning-view";
import { redirect } from "next/navigation";

export default async function SalariePlanningPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Récupération des shifts du salarié
  const [shifts, replacementRequests] = await Promise.all([
    prisma.shift.findMany({
    where: {
      userId: user.id,
      status: { not: "ANNULE" },
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
      }))}
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
