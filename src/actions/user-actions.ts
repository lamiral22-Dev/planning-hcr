"use server";

import { prisma } from "@/lib/prisma";
import { requireUserWithRoles } from "@/lib/auth";
import {
  CreateUserSchema,
  UpdateUserSchema,
  ToggleUserStatusSchema,
  type CreateUserInput,
  type UpdateUserInput,
  type ToggleUserStatusInput,
} from "@/schemas/validations";
import type { Role, Prisma } from "@prisma/client";

export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string; fieldErrors?: Record<string, string[]> };

export interface UserListItem {
  id: string;
  matricule: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  contractWeeklyHours: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Récupère la liste des utilisateurs avec filtres optionnels.
 * RBAC : MANAGER ou SUPER_ADMIN.
 */
export async function getUsers(filter?: {
  role?: Role;
  isActive?: boolean;
  search?: string;
}): Promise<ActionResult<UserListItem[]>> {
  try {
    await requireUserWithRoles(["MANAGER", "SUPER_ADMIN"]);

    const where: Prisma.UserWhereInput = {};

    if (filter?.role) {
      where.role = filter.role;
    }

    if (filter?.isActive !== undefined) {
      where.isActive = filter.isActive;
    }

    if (filter?.search && filter.search.trim()) {
      const q = filter.search.trim();
      where.OR = [
        { matricule: { contains: q, mode: "insensitive" } },
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        matricule: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        contractWeeklyHours: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ isActive: "desc" }, { lastName: "asc" }, { firstName: "asc" }],
    });

    return { success: true, data: users };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return { success: false, error: message };
  }
}

/**
 * Crée un nouveau collaborateur avec contrôle d'unicité et traçabilité AuditLog.
 * RBAC : MANAGER ou SUPER_ADMIN.
 */
export async function createUser(input: CreateUserInput): Promise<ActionResult<UserListItem>> {
  try {
    const actor = await requireUserWithRoles(["MANAGER", "SUPER_ADMIN"]);
    const validated = CreateUserSchema.parse(input);

    // Vérifier l'unicité du matricule
    const existingMatricule = await prisma.user.findUnique({
      where: { matricule: validated.matricule },
    });
    if (existingMatricule) {
      return {
        success: false,
        error: `Le matricule ${validated.matricule} est déjà attribué.`,
        code: "MATRICULE_ALREADY_EXISTS",
      };
    }

    // Vérifier l'unicité de l'email
    const existingEmail = await prisma.user.findUnique({
      where: { email: validated.email },
    });
    if (existingEmail) {
      return {
        success: false,
        error: `L'adresse email ${validated.email} est déjà utilisée.`,
        code: "EMAIL_ALREADY_EXISTS",
      };
    }

    const passwordHash = validated.password && validated.password.length >= 6
      ? `hash_${validated.password}`
      : `hash_default_${validated.matricule}`;

    const timestamp = new Date();

    const createdUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          matricule: validated.matricule,
          firstName: validated.firstName,
          lastName: validated.lastName,
          email: validated.email,
          role: validated.role,
          contractWeeklyHours: validated.contractWeeklyHours,
          isActive: validated.isActive ?? true,
          passwordHash,
        },
        select: {
          id: true,
          matricule: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          contractWeeklyHours: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "USER_CREATED",
          tableName: "User",
          recordId: user.id,
          userId: actor.id,
          payloadNew: user as unknown as Prisma.InputJsonValue,
          timestamp,
        },
      });

      return user;
    });

    return { success: true, data: createdUser };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return { success: false, error: message };
  }
}

/**
 * Met à jour un collaborateur existant avec traçabilité AuditLog.
 * RBAC : MANAGER ou SUPER_ADMIN.
 */
export async function updateUser(input: UpdateUserInput): Promise<ActionResult<UserListItem>> {
  try {
    const actor = await requireUserWithRoles(["MANAGER", "SUPER_ADMIN"]);
    const validated = UpdateUserSchema.parse(input);

    const currentUser = await prisma.user.findUnique({
      where: { id: validated.id },
    });

    if (!currentUser) {
      return { success: false, error: "Collaborateur introuvable.", code: "NOT_FOUND" };
    }

    // Vérifier unicité matricule si modifié
    if (validated.matricule && validated.matricule !== currentUser.matricule) {
      const existingMatricule = await prisma.user.findUnique({
        where: { matricule: validated.matricule },
      });
      if (existingMatricule) {
        return {
          success: false,
          error: `Le matricule ${validated.matricule} est déjà attribué.`,
          code: "MATRICULE_ALREADY_EXISTS",
        };
      }
    }

    // Vérifier unicité email si modifié
    if (validated.email && validated.email !== currentUser.email) {
      const existingEmail = await prisma.user.findUnique({
        where: { email: validated.email },
      });
      if (existingEmail) {
        return {
          success: false,
          error: `L'adresse email ${validated.email} est déjà utilisée.`,
          code: "EMAIL_ALREADY_EXISTS",
        };
      }
    }

    const updateData: Prisma.UserUpdateInput = {};
    if (validated.matricule) updateData.matricule = validated.matricule;
    if (validated.firstName) updateData.firstName = validated.firstName;
    if (validated.lastName) updateData.lastName = validated.lastName;
    if (validated.email) updateData.email = validated.email;
    if (validated.role) updateData.role = validated.role;
    if (validated.contractWeeklyHours !== undefined) {
      updateData.contractWeeklyHours = validated.contractWeeklyHours;
    }
    if (validated.isActive !== undefined) {
      updateData.isActive = validated.isActive;
    }
    if (validated.password && validated.password.trim().length >= 6) {
      updateData.passwordHash = `hash_${validated.password}`;
    }

    const timestamp = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: validated.id },
        data: updateData,
        select: {
          id: true,
          matricule: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          contractWeeklyHours: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "USER_UPDATED",
          tableName: "User",
          recordId: user.id,
          userId: actor.id,
          payloadOld: {
            matricule: currentUser.matricule,
            email: currentUser.email,
            firstName: currentUser.firstName,
            lastName: currentUser.lastName,
            role: currentUser.role,
            contractWeeklyHours: currentUser.contractWeeklyHours,
            isActive: currentUser.isActive,
          } as unknown as Prisma.InputJsonValue,
          payloadNew: user as unknown as Prisma.InputJsonValue,
          timestamp,
        },
      });

      return user;
    });

    return { success: true, data: updated };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return { success: false, error: message };
  }
}

/**
 * Active ou archive logiquement un collaborateur.
 * Garde-fou anti-auto-désactivation : le manager connecté ne peut pas désactiver son propre compte.
 * RBAC : MANAGER ou SUPER_ADMIN.
 */
export async function toggleUserActiveStatus(
  input: ToggleUserStatusInput
): Promise<ActionResult<UserListItem>> {
  try {
    const actor = await requireUserWithRoles(["MANAGER", "SUPER_ADMIN"]);
    const validated = ToggleUserStatusSchema.parse(input);

    // Garde-fou anti-auto-désactivation
    if (!validated.isActive && actor.id === validated.userId) {
      return {
        success: false,
        error: "Action impossible : vous ne pouvez pas désactiver votre propre compte manager.",
        code: "CANNOT_DEACTIVATE_SELF",
      };
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: validated.userId },
    });

    if (!currentUser) {
      return { success: false, error: "Collaborateur introuvable.", code: "NOT_FOUND" };
    }

    const action = validated.isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED";
    const timestamp = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: validated.userId },
        data: { isActive: validated.isActive },
        select: {
          id: true,
          matricule: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          contractWeeklyHours: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await tx.auditLog.create({
        data: {
          action,
          tableName: "User",
          recordId: user.id,
          userId: actor.id,
          payloadOld: { isActive: currentUser.isActive } as unknown as Prisma.InputJsonValue,
          payloadNew: { isActive: user.isActive } as unknown as Prisma.InputJsonValue,
          timestamp,
        },
      });

      return user;
    });

    return { success: true, data: updated };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return { success: false, error: message };
  }
}
