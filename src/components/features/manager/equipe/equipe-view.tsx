"use client";

import React, { useState, useTransition } from "react";
import { UserTable } from "./user-table";
import { UserFormModal } from "./user-form-modal";
import { UserDeactivateDialog } from "./user-deactivate-dialog";
import { Button } from "@/components/ui/button";
import { getUsers, type UserListItem } from "@/actions/user-actions";
import { Plus, Search, Users, RefreshCw } from "lucide-react";
import type { Role } from "@prisma/client";

interface EquipeViewProps {
  initialUsers: UserListItem[];
  currentUserId?: string;
}

export function EquipeView({ initialUsers, currentUserId }: EquipeViewProps) {
  const [users, setUsers] = useState<UserListItem[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserListItem | null>(null);

  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false);
  const [userToDeactivate, setUserToDeactivate] = useState<UserListItem | null>(null);

  const [isPending, startTransition] = useTransition();

  const loadUsers = async () => {
    startTransition(async () => {
      const roleParam = roleFilter !== "ALL" ? (roleFilter as Role) : undefined;
      const statusParam =
        statusFilter === "ACTIVE" ? true : statusFilter === "INACTIVE" ? false : undefined;

      const res = await getUsers({
        role: roleParam,
        isActive: statusParam,
        search: search.trim() || undefined,
      });

      if (res.success) {
        setUsers(res.data);
      }
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadUsers();
  };

  const handleOpenCreate = () => {
    setUserToEdit(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (user: UserListItem) => {
    setUserToEdit(user);
    setIsFormOpen(true);
  };

  const handleOpenToggleStatus = (user: UserListItem) => {
    setUserToDeactivate(user);
    setIsDeactivateOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            Gestion de l&apos;Équipe
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Gérez les fiches salariés, volumes contractuels et statuts d&apos;activité des équipiers.
          </p>
        </div>

        <Button
          onClick={handleOpenCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Ajouter un collaborateur
        </Button>
      </div>

      {/* Barre de filtres */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom, prénom, email ou matricule..."
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Button type="submit" variant="outline" size="sm" className="h-9">
            Rechercher
          </Button>
        </form>

        <div className="flex items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
            }}
            className="px-3 py-2 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">Tous les rôles</option>
            <option value="SALARIE">Salarié</option>
            <option value="MANAGER">Manager</option>
            <option value="SUPER_ADMIN">Super Admin</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
            }}
            className="px-3 py-2 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="ACTIVE">Actifs uniquement</option>
            <option value="INACTIVE">Archivés uniquement</option>
          </select>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadUsers}
            disabled={isPending}
            title="Rafraîchir"
            className="h-9 px-2.5"
          >
            <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Tableau des utilisateurs */}
      <UserTable
        users={users}
        onEdit={handleOpenEdit}
        onToggleStatus={handleOpenToggleStatus}
        currentUserId={currentUserId}
      />

      {/* Modal Ajout/Modification */}
      <UserFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={loadUsers}
        userToEdit={userToEdit}
      />

      {/* Modal Désactivation/Réactivation */}
      <UserDeactivateDialog
        isOpen={isDeactivateOpen}
        onClose={() => setIsDeactivateOpen(false)}
        onSuccess={loadUsers}
        user={userToDeactivate}
      />
    </div>
  );
}
