"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { UserListItem } from "@/actions/user-actions";
import { Edit2, UserCheck, UserX, Clock } from "lucide-react";

interface UserTableProps {
  users: UserListItem[];
  onEdit: (user: UserListItem) => void;
  onToggleStatus: (user: UserListItem) => void;
  currentUserId?: string;
}

export function UserTable({
  users,
  onEdit,
  onToggleStatus,
  currentUserId,
}: UserTableProps) {
  if (users.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
        <p className="text-sm text-slate-500 font-medium">
          Aucun collaborateur trouvé pour les critères sélectionnés.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-white rounded-lg border border-slate-200 shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-xs uppercase tracking-wider">
          <tr>
            <th className="px-4 py-3">Matricule</th>
            <th className="px-4 py-3">Collaborateur</th>
            <th className="px-4 py-3">Rôle HCR</th>
            <th className="px-4 py-3">Contrat Hebdo</th>
            <th className="px-4 py-3">Statut</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {users.map((user) => {
            const isSelf = currentUserId === user.id;

            return (
              <tr
                key={user.id}
                className={`hover:bg-slate-50 transition-colors ${
                  !user.isActive ? "bg-slate-50/50 opacity-75" : ""
                }`}
              >
                <td className="px-4 py-3 font-mono font-medium text-slate-800">
                  {user.matricule}
                </td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-900">
                    {user.lastName} {user.firstName}
                  </div>
                  <div className="text-xs text-slate-500">{user.email}</div>
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant={
                      user.role === "SUPER_ADMIN"
                        ? "danger"
                        : user.role === "MANAGER"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {user.role}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{user.contractWeeklyHours}h / semaine</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {user.isActive ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Actif
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                      Archivé
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right space-x-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(user)}
                    className="h-8 px-2.5 text-xs text-slate-700"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1" />
                    Modifier
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onToggleStatus(user)}
                    disabled={isSelf && user.isActive}
                    title={
                      isSelf && user.isActive
                        ? "Vous ne pouvez pas désactiver votre propre compte"
                        : user.isActive
                        ? "Désactiver le compte"
                        : "Réactiver le compte"
                    }
                    className={`h-8 px-2.5 text-xs ${
                      user.isActive
                        ? "text-amber-700 hover:text-amber-800 hover:bg-amber-50 border-amber-200"
                        : "text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-200"
                    }`}
                  >
                    {user.isActive ? (
                      <>
                        <UserX className="w-3.5 h-3.5 mr-1" />
                        Désactiver
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-3.5 h-3.5 mr-1" />
                        Réactiver
                      </>
                    )}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
