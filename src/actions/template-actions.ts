"use server";

import { prisma } from "@/lib/prisma";
import { requireUserWithRoles } from "@/lib/auth";
import {
  MasterTemplateSchema,
  type MasterTemplateInput,
} from "@/schemas/validations";
import type { Prisma } from "@prisma/client";

export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string; fieldErrors?: Record<string, string[]> };

/**
 * Récupération de tous les créneaux du planning type ordonnés par semaine et jour.
 * RBAC : MANAGER ou SUPER_ADMIN.
 */
export async function getMasterTemplates(): Promise<ActionResult> {
  try {
    await requireUserWithRoles(["MANAGER", "SUPER_ADMIN"]);

    const templates = await prisma.masterTemplate.findMany({
      orderBy: [{ weekNumber: "asc" }, { dayOfWeek: "asc" }, { startTime: "asc" }],
    });

    return { success: true, data: templates };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return { success: false, error: message };
  }
}

/**
 * Création ou mise à jour d'un créneau du planning type.
 * RBAC : MANAGER ou SUPER_ADMIN avec traçabilité AuditLog.
 */
export async function upsertMasterTemplate(
  input: MasterTemplateInput
): Promise<ActionResult> {
  try {
    const manager = await requireUserWithRoles(["MANAGER", "SUPER_ADMIN"]);
    const validated = MasterTemplateSchema.parse(input);

    const result = await prisma.$transaction(async (tx) => {
      let template;
      let action: string;
      let payloadOld = null;

      if (validated.id) {
        payloadOld = await tx.masterTemplate.findUnique({
          where: { id: validated.id },
        });

        template = await tx.masterTemplate.update({
          where: { id: validated.id },
          data: {
            name: validated.name,
            weekNumber: validated.weekNumber,
            dayOfWeek: validated.dayOfWeek,
            startTime: validated.startTime,
            endTime: validated.endTime,
            roleTarget: validated.roleTarget,
            isActive: validated.isActive,
          },
        });
        action = "MASTER_TEMPLATE_UPDATED";
      } else {
        template = await tx.masterTemplate.create({
          data: {
            name: validated.name,
            weekNumber: validated.weekNumber,
            dayOfWeek: validated.dayOfWeek,
            startTime: validated.startTime,
            endTime: validated.endTime,
            roleTarget: validated.roleTarget,
            isActive: validated.isActive,
          },
        });
        action = "MASTER_TEMPLATE_CREATED";
      }

      await tx.auditLog.create({
        data: {
          action,
          tableName: "MasterTemplate",
          recordId: template.id,
          userId: manager.id,
          payloadOld: payloadOld as unknown as Prisma.InputJsonValue,
          payloadNew: template as unknown as Prisma.InputJsonValue,
          timestamp: new Date(),
        },
      });

      return template;
    });

    return { success: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return { success: false, error: message };
  }
}

/**
 * Suppression d'un créneau type.
 * RBAC : MANAGER ou SUPER_ADMIN avec traçabilité AuditLog.
 */
export async function deleteMasterTemplate(id: string): Promise<ActionResult> {
  try {
    const manager = await requireUserWithRoles(["MANAGER", "SUPER_ADMIN"]);

    const current = await prisma.masterTemplate.findUnique({
      where: { id },
    });

    if (!current) {
      return { success: false, error: "Créneau type introuvable", code: "NOT_FOUND" };
    }

    await prisma.$transaction(async (tx) => {
      await tx.masterTemplate.delete({
        where: { id },
      });

      await tx.auditLog.create({
        data: {
          action: "MASTER_TEMPLATE_DELETED",
          tableName: "MasterTemplate",
          recordId: id,
          userId: manager.id,
          payloadOld: current as unknown as Prisma.InputJsonValue,
          timestamp: new Date(),
        },
      });
    });

    return { success: true, data: { id } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return { success: false, error: message };
  }
}
