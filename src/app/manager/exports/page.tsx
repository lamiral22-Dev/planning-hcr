import React from "react";
import { prisma } from "@/lib/prisma";
import { ExportsView } from "@/components/features/manager/exports/exports-view";
import { startOfMonth, endOfMonth } from "date-fns";

export const dynamic = "force-dynamic";

export default async function ManagerExportsPage() {
  const now = new Date();
  const start = startOfMonth(now);
  const end = endOfMonth(now);

  const entries = await prisma.timeEntry.findMany({
    where: {
      clockInTime: {
        gte: start,
        lte: end,
      },
    },
    select: {
      id: true,
      userId: true,
      clockInTime: true,
      roundedClockOutTime: true,
      qualification: true,
    },
  });

  const distinctUsers = new Set(entries.map((e) => e.userId));
  let totalHours = 0;
  let totalAbsences = 0;

  for (const entry of entries) {
    if (
      entry.qualification === "ABSENT_INJUSTIFIE" ||
      entry.qualification === "MALADIE" ||
      entry.qualification === "VACANCES"
    ) {
      totalAbsences++;
    } else if (entry.roundedClockOutTime) {
      const diffMs = entry.roundedClockOutTime.getTime() - entry.clockInTime.getTime();
      if (diffMs > 0) {
        totalHours += diffMs / (1000 * 60 * 60);
      }
    }
  }

  return (
    <ExportsView
      initialSummary={{
        totalHours,
        totalAbsences,
        totalEmployees: distinctUsers.size,
      }}
    />
  );
}
