"use client";

import React, { useState, useEffect } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreateUserSchema, UpdateUserSchema, type CreateUserInput } from "@/schemas/validations";
import { createUser, updateUser, type UserListItem } from "@/actions/user-actions";
import type { Role } from "@prisma/client";

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userToEdit?: UserListItem | null;
}

export function UserFormModal({
  isOpen,
  onClose,
  onSuccess,
  userToEdit,
}: UserFormModalProps) {
  const isEditing = Boolean(userToEdit);

  const [matricule, setMatricule] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("SALARIE");
  const [contractWeeklyHours, setContractWeeklyHours] = useState<number>(35);
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState<boolean>(true);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (userToEdit) {
      setMatricule(userToEdit.matricule);
      setFirstName(userToEdit.firstName);
      setLastName(userToEdit.lastName);
      setEmail(userToEdit.email);
      setRole(userToEdit.role);
      setContractWeeklyHours(userToEdit.contractWeeklyHours);
      setIsActive(userToEdit.isActive);
      setPassword("");
    } else {
      setMatricule("");
      setFirstName("");
      setLastName("");
      setEmail("");
      setRole("SALARIE");
      setContractWeeklyHours(35);
      setIsActive(true);
      setPassword("");
    }
    setErrors({});
    setServerError(null);
  }, [userToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setServerError(null);

    if (isEditing && userToEdit) {
      const payload = {
        id: userToEdit.id,
        matricule,
        firstName,
        lastName,
        email,
        role,
        contractWeeklyHours: Number(contractWeeklyHours),
        isActive,
        password: password.trim() ? password : undefined,
      };

      const parseResult = UpdateUserSchema.safeParse(payload);
      if (!parseResult.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parseResult.error.issues) {
          const path = issue.path[0] as string;
          fieldErrors[path] = issue.message;
        }
        setErrors(fieldErrors);
        return;
      }

      setIsSubmitting(true);
      const res = await updateUser(parseResult.data);
      setIsSubmitting(false);

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setServerError(res.error);
      }
    } else {
      const payload: CreateUserInput = {
        matricule,
        firstName,
        lastName,
        email,
        role,
        contractWeeklyHours: Number(contractWeeklyHours),
        isActive,
        password: password.trim() ? password : undefined,
      };

      const parseResult = CreateUserSchema.safeParse(payload);
      if (!parseResult.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parseResult.error.issues) {
          const path = issue.path[0] as string;
          fieldErrors[path] = issue.message;
        }
        setErrors(fieldErrors);
        return;
      }

      setIsSubmitting(true);
      const res = await createUser(parseResult.data);
      setIsSubmitting(false);

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setServerError(res.error);
      }
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Modifier la fiche collaborateur" : "Ajouter un collaborateur"}
      description={
        isEditing
          ? "Modifiez les informations contractuelles ou le rôle du salarié."
          : "Renseignez les données obligatoires du nouveau membre de l'équipe."
      }
    >
      <div className="space-y-4 pt-2">
        {serverError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Matricule unique *
              </label>
              <input
                type="text"
                value={matricule}
                onChange={(e) => setMatricule(e.target.value)}
                placeholder="ex: SAL-001"
                className="w-full px-3 py-2 border rounded-md text-sm border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.matricule && (
                <p className="text-xs text-red-600 mt-1">{errors.matricule}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Rôle HCR *
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full px-3 py-2 border rounded-md text-sm border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="SALARIE">SALARIÉ</option>
                <option value="MANAGER">MANAGER</option>
                <option value="SUPER_ADMIN">SUPER_ADMIN</option>
              </select>
              {errors.role && (
                <p className="text-xs text-red-600 mt-1">{errors.role}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Prénom *
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="ex: Thomas"
                className="w-full px-3 py-2 border rounded-md text-sm border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.firstName && (
                <p className="text-xs text-red-600 mt-1">{errors.firstName}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nom *
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="ex: Rousseau"
                className="w-full px-3 py-2 border rounded-md text-sm border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.lastName && (
                <p className="text-xs text-red-600 mt-1">{errors.lastName}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Adresse email professionnelle *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ex: thomas@resto.fr"
              className="w-full px-3 py-2 border rounded-md text-sm border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.email && (
              <p className="text-xs text-red-600 mt-1">{errors.email}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Volume hebdomadaire contractuel (heures) *
              </label>
              <input
                type="number"
                step="0.5"
                min="1"
                max="48"
                value={contractWeeklyHours}
                onChange={(e) => setContractWeeklyHours(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border rounded-md text-sm border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.contractWeeklyHours && (
                <p className="text-xs text-red-600 mt-1">{errors.contractWeeklyHours}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isEditing ? "Nouveau mot de passe (optionnel)" : "Mot de passe (optionnel)"}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isEditing ? "Laisser vide pour conserver" : "6 car. min"}
                className="w-full px-3 py-2 border rounded-md text-sm border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.password && (
                <p className="text-xs text-red-600 mt-1">{errors.password}</p>
              )}
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSubmitting
                ? "Enregistrement..."
                : isEditing
                ? "Enregistrer les modifications"
                : "Créer le collaborateur"}
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}
