import React from "react";
import { prisma } from "@/lib/prisma";
import { requireUserWithRoles, getCurrentUser } from "@/lib/auth";
import { EquipeView } from "@/components/features/manager/equipe/equipe-view";
import type { UserListItem } from "@/actions/user-actions";

export const metadata = {
  title: "Gestion de l'Équipe | Planning & Pointage HCR",
};

export default async function ManagerEquipePage() {
  await requireUserWithRoles(["MANAGER", "SUPER_ADMIN"]);
  const currentUser = await getCurrentUser();

  const users = await prisma.user.findMany({
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

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <EquipeView
        initialUsers={users as UserListItem[]}
        currentUserId={currentUser?.id}
      />
    </div>
  );
}
