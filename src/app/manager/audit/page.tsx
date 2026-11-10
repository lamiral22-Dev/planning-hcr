import React from "react";
import { prisma } from "@/lib/prisma";
import { requireUserWithRoles } from "@/lib/auth";
import { AuditView } from "@/components/features/manager/audit/audit-view";
import type { AuditLogItem } from "@/actions/audit-actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Registre d'Audit Légal | Planning & Pointage HCR",
};

export default async function ManagerAuditPage() {
  await requireUserWithRoles(["MANAGER", "SUPER_ADMIN"]);

  const [totalCount, rawLogs, usersList] = await prisma.$transaction([
    prisma.auditLog.count(),
    prisma.auditLog.findMany({
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { timestamp: "desc" },
      take: 100,
    }),
    prisma.user.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        matricule: true,
      },
      orderBy: { lastName: "asc" },
    }),
  ]);

  const initialLogs: AuditLogItem[] = rawLogs.map((log) => ({
    id: log.id,
    action: log.action,
    tableName: log.tableName,
    recordId: log.recordId,
    userId: log.userId,
    userName: log.user ? `${log.user.lastName} ${log.user.firstName}`.trim() : "Système",
    userRole: log.user ? log.user.role : null,
    timestamp: log.timestamp,
    payloadOld: log.payloadOld,
    payloadNew: log.payloadNew,
  }));

  const users = usersList.map((u) => ({
    id: u.id,
    name: `${u.lastName} ${u.firstName}`.trim(),
    matricule: u.matricule,
  }));

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <AuditView
        initialLogs={initialLogs}
        totalCount={totalCount}
        users={users}
      />
    </div>
  );
}
