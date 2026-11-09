"use client";

import React, { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toggleUserActiveStatus, type UserListItem } from "@/actions/user-actions";
import { AlertTriangle, CheckCircle } from "lucide-react";

interface UserDeactivateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: UserListItem | null;
}

export function UserDeactivateDialog({
  isOpen,
  onClose,
  onSuccess,
  user,
}: UserDeactivateDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  if (!user) return null;

  const isArchiving = user.isActive;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setServerError(null);

    const res = await toggleUserActiveStatus({
      userId: user.id,
      isActive: !isArchiving,
    });

    setIsSubmitting(false);

    if (res.success) {
      onSuccess();
      onClose();
    } else {
      setServerError(res.error);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={isArchiving ? "Désactiver le collaborateur" : "Réactiver le collaborateur"}
      description={`Collaborateur concerné : ${user.firstName} ${user.lastName} (${user.matricule})`}
    >
      <div className="space-y-4 pt-2">
        <div className="flex items-center gap-2">
          {isArchiving ? (
            <div className="p-2 bg-amber-100 rounded-full text-amber-700">
              <AlertTriangle className="w-5 h-5" />
            </div>
          ) : (
            <div className="p-2 bg-green-100 rounded-full text-green-700">
              <CheckCircle className="w-5 h-5" />
            </div>
          )}
          <span className="font-semibold text-slate-800 text-sm">
            {isArchiving ? "Confirmation de mise en sommeil" : "Réactivation pour planning"}
          </span>
        </div>

        {serverError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {serverError}
          </div>
        )}

        <div className="text-sm text-slate-600 space-y-2">
          {isArchiving ? (
            <>
              <p>
                Êtes-vous sûr de vouloir archiver le profil de{" "}
                <span className="font-semibold text-slate-900">
                  {user.firstName} {user.lastName} ({user.matricule})
                </span>{" "}
                ?
              </p>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600">
                <span className="font-semibold">Préservation d&apos;intégrité légale :</span> Le profil
                ne sera pas supprimé de la base. Tous ses plannings passés, émargements et relevés de pointage
                restent intégralement consultables pour les contrôles et les archives de paie.
              </div>
            </>
          ) : (
            <p>
              Voulez-vous réactiver le collaborateur{" "}
              <span className="font-semibold text-slate-900">
                {user.firstName} {user.lastName} ({user.matricule})
              </span>{" "}
              ? Il pourra à nouveau être affecté aux prochains plannings.
            </p>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className={
              isArchiving
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : "bg-green-600 hover:bg-green-700 text-white"
            }
          >
            {isSubmitting
              ? "Opération en cours..."
              : isArchiving
              ? "Confirmer la désactivation"
              : "Réactiver le profil"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
