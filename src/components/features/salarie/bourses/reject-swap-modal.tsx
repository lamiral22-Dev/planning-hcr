"use client";

import React, { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface RejectSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isLoading?: boolean;
}

export function RejectSwapModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}: RejectSwapModalProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const handleConfirm = () => {
    if (!reason.trim()) {
      setError("Le motif de refus est obligatoire.");
      return;
    }
    setError("");
    onConfirm(reason.trim());
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Refuser la proposition d'échange"
      description="Indiquez à votre collègue la raison de votre refus."
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reject-reason" className="text-sm font-semibold text-gray-700">
            Motif de refus :
          </label>
          <textarea
            id="reject-reason"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError("");
            }}
            placeholder="Ex : Indisponible sur ce créneau, contrainte personnelle..."
            rows={3}
            className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading} className="flex-1">
            Annuler
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            disabled={isLoading}
            className="flex-1 bg-rose-600 hover:bg-rose-700"
          >
            {isLoading ? "Enregistrement..." : "Confirmer le refus"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
