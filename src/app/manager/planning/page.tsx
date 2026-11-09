import React from "react";
import { prisma } from "@/lib/prisma";
import { PlanningQuinzaineView } from "@/components/features/manager/planning/planning-quinzaine-view";

export const dynamic = "force-dynamic";

export default async function ManagerPlanningPage() {
  const employees = await prisma.user.findMany({
    where: { role: "SALARIE" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
    },
    orderBy: [{ isActive: "desc" }, { lastName: "asc" }],
  });

  const shifts = await prisma.shift.findMany({
    where: {
      status: { not: "ANNULE" },
    },
    select: {
      id: true,
      userId: true,
      startTime: true,
      endTime: true,
      status: true,
      isLateModification: true,
    },
    orderBy: { startTime: "asc" },
  });

  const formattedEmployees = employees.map((e) => ({
    id: e.id,
    name: `${e.firstName} ${e.lastName}`,
    role: "Salarié HCR",
    isActive: e.isActive,
  }));

  return (
    <PlanningQuinzaineView
      employees={formattedEmployees}
      initialShifts={shifts.map((s) => ({
        ...s,
        startTime: s.startTime.toISOString(),
        endTime: s.endTime.toISOString(),
      }))}
    />
  );
}
