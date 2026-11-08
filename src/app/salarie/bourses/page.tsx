import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { BoursesView } from "@/components/features/salarie/bourses/bourses-view";
import { redirect } from "next/navigation";

export default async function SalarieBoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ proposeShiftId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { proposeShiftId } = await searchParams;

  // Récupération des demandes envoyées par le salarié
  const sentSwapsRaw = await prisma.shiftSwap.findMany({
    where: { requesterId: user.id },
    include: {
      targetUser: { select: { firstName: true, lastName: true } },
      shift: { select: { startTime: true, endTime: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Récupération des demandes reçues par le salarié
  const receivedSwapsRaw = await prisma.shiftSwap.findMany({
    where: { targetUserId: user.id },
    include: {
      requester: { select: { firstName: true, lastName: true } },
      shift: { select: { startTime: true, endTime: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Récupération des collègues (hors l'utilisateur lui-même)
  const colleaguesRaw = await prisma.user.findMany({
    where: {
      id: { not: user.id },
      role: "SALARIE",
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  });

  // Récupération des shifts du salarié éligibles à l'échange (statut PUBLIE)
  const myEligibleShiftsRaw = await prisma.shift.findMany({
    where: {
      userId: user.id,
      status: "PUBLIE",
      startTime: { gte: new Date() },
    },
    orderBy: { startTime: "asc" },
  });

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  const formatDate = (d: Date) =>
    d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });

  const sentSwaps = sentSwapsRaw.map((s) => ({
    id: s.id,
    shiftId: s.shiftId,
    requesterId: s.requesterId,
    targetUserId: s.targetUserId,
    status: s.status,
    reason: s.reason,
    rejectedReason: s.rejectedReason,
    createdAt: s.createdAt,
    requesterName: `${user.firstName} ${user.lastName}`,
    targetUserName: `${s.targetUser.firstName} ${s.targetUser.lastName}`,
    shiftDateStr: formatDate(s.shift.startTime),
    shiftTimeStr: `${formatTime(s.shift.startTime)} - ${formatTime(s.shift.endTime)}`,
  }));

  const receivedSwaps = receivedSwapsRaw.map((s) => ({
    id: s.id,
    shiftId: s.shiftId,
    requesterId: s.requesterId,
    targetUserId: s.targetUserId,
    status: s.status,
    reason: s.reason,
    rejectedReason: s.rejectedReason,
    createdAt: s.createdAt,
    requesterName: `${s.requester.firstName} ${s.requester.lastName}`,
    targetUserName: `${user.firstName} ${user.lastName}`,
    shiftDateStr: formatDate(s.shift.startTime),
    shiftTimeStr: `${formatTime(s.shift.startTime)} - ${formatTime(s.shift.endTime)}`,
  }));

  const myEligibleShifts = myEligibleShiftsRaw.map((s) => ({
    id: s.id,
    label: `${formatDate(s.startTime)} (${formatTime(s.startTime)} - ${formatTime(s.endTime)})`,
  }));

  const colleagues = colleaguesRaw.map((c) => ({
    id: c.id,
    name: `${c.firstName} ${c.lastName}`,
  }));

  return (
    <BoursesView
      currentUserId={user.id}
      sentSwaps={sentSwaps}
      receivedSwaps={receivedSwaps}
      myEligibleShifts={myEligibleShifts}
      colleagues={colleagues}
      initialProposeShiftId={proposeShiftId ?? null}
    />
  );
}
