import React from "react";
import { prisma } from "@/lib/prisma";
import { ArbitrageView } from "@/components/features/manager/arbitrage/arbitrage-view";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function ManagerArbitragePage() {
  // Pointages en anomalie ou sans pointage (imprévus)
  const timeEntries = await prisma.timeEntry.findMany({
    where: {
      qualification: { not: "CONFORME" },
    },
    include: {
      user: true,
      shift: true,
    },
    orderBy: { clockInTime: "desc" },
    take: 50,
  });

  // Shifts terminés sans aucun timeEntry (non-pointés)
  const shiftsWithoutEntry = await prisma.shift.findMany({
    where: {
      status: "PUBLIE",
      endTime: { lte: new Date() },
      timeEntries: { none: {} },
    },
    include: {
      user: true,
    },
    take: 20,
  });

  // Bourse d'échanges en attente de manager
  const pendingSwaps = await prisma.shiftSwap.findMany({
    where: {
      status: "EN_ATTENTE_MANAGER",
    },
    include: {
      shift: true,
      requester: true,
      targetUser: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const discrepancies = [
    ...timeEntries.map((te) => ({
      id: te.id,
      timeEntryId: te.id,
      shiftId: te.shiftId ?? "",
      employeeName: `${te.user.firstName} ${te.user.lastName}`,
      date: te.clockInTime.toISOString(),
      plannedStart: te.shift?.startTime ? te.shift.startTime.toISOString() : te.clockInTime.toISOString(),
      plannedEnd: te.shift?.endTime ? te.shift.endTime.toISOString() : te.clockInTime.toISOString(),
      rawClockIn: te.clockInTime.toISOString(),
      rawClockOut: te.rawClockOutTime ? te.rawClockOutTime.toISOString() : null,
      roundedClockOut: te.roundedClockOutTime ? te.roundedClockOutTime.toISOString() : null,
      employeeReason: te.discrepancyReason,
      currentQualification: te.qualification,
    })),
    ...shiftsWithoutEntry.map((s) => ({
      id: `unclocked-${s.id}`,
      shiftId: s.id,
      employeeName: `${s.user.firstName} ${s.user.lastName}`,
      date: s.startTime.toISOString(),
      plannedStart: s.startTime.toISOString(),
      plannedEnd: s.endTime.toISOString(),
      rawClockIn: null,
      rawClockOut: null,
      roundedClockOut: null,
      employeeReason: null,
    })),
  ];

  const formattedSwaps = pendingSwaps.map((sw) => ({
    id: sw.id,
    shiftId: sw.shiftId,
    shiftDate: sw.shift.startTime.toISOString(),
    shiftTime: `${format(sw.shift.startTime, "HH:mm")} - ${format(sw.shift.endTime, "HH:mm")}`,
    requesterName: `${sw.requester.firstName} ${sw.requester.lastName}`,
    targetUserName: `${sw.targetUser.firstName} ${sw.targetUser.lastName}`,
    reason: sw.reason,
  }));

  return (
    <ArbitrageView
      discrepancies={discrepancies}
      swaps={formattedSwaps}
    />
  );
}
