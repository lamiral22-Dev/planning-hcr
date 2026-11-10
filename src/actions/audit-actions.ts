"use server";

import { prisma } from "@/lib/prisma";
import { requireUserWithRoles } from "@/lib/auth";
import { AuditQuerySchema, type AuditQueryInput } from "@/schemas/validations";
import type { Prisma } from "@prisma/client";

export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string; fieldErrors?: Record<string, string[]> };

export interface AuditLogItem {
  id: string;
  action: string;
  tableName: string;
  recordId: string;
  userId: string | null;
  userName?: string | null;
  userRole?: string | null;
  timestamp: Date;
  payloadOld?: unknown;
  payloadNew?: unknown;
}

/**
 * Récupère les logs d'audit avec filtres et pagination.
 * RBAC : MANAGER ou SUPER_ADMIN.
 */
export async function getAuditLogs(
  query?: AuditQueryInput
): Promise<ActionResult<{ logs: AuditLogItem[]; totalCount: number }>> {
  try {
    await requireUserWithRoles(["MANAGER", "SUPER_ADMIN"]);
    const validated = AuditQuerySchema.parse(query ?? {});

    const where: Prisma.AuditLogWhereInput = {};

    if (validated.userId) {
      where.OR = [
        { userId: validated.userId },
        { recordId: validated.userId },
      ];
    }

    if (validated.action && validated.action.trim()) {
      where.action = validated.action.trim();
    }

    if (validated.startDate || validated.endDate) {
      where.timestamp = {};
      if (validated.startDate) {
        where.timestamp.gte = validated.startDate;
      }
      if (validated.endDate) {
        where.timestamp.lte = validated.endDate;
      }
    }

    const [totalCount, rawLogs] = await prisma.$transaction([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
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
        take: validated.limit,
        skip: validated.offset,
      }),
    ]);

    const logs: AuditLogItem[] = rawLogs.map((log) => ({
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

    return { success: true, data: { logs, totalCount } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return { success: false, error: message };
  }
}

/**
 * Récupère le détail exhaustif d'un log d'audit.
 * RBAC : MANAGER ou SUPER_ADMIN.
 */
export async function getAuditLogById(id: string): Promise<ActionResult<AuditLogItem>> {
  try {
    await requireUserWithRoles(["MANAGER", "SUPER_ADMIN"]);

    const log = await prisma.auditLog.findUnique({
      where: { id },
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
    });

    if (!log) {
      return { success: false, error: "Entrée d'audit introuvable.", code: "NOT_FOUND" };
    }

    const item: AuditLogItem = {
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
    };

    return { success: true, data: item };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return { success: false, error: message };
  }
}

