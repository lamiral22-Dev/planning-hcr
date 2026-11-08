"use client";

import React, { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface ClockOutDiscrepancyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  rawTime: Date;
  roundedTime: Date;
  scheduledEndTime?: Date;
  isLoading?: boolean;
}

export function ClockOutDiscrepancyModal({
  isOpen,
  onClose,
  onConfirm,
  rawTime,
  roundedTime,
  scheduledEndTime,
  isLoading,
}: ClockOutDiscrepancyModalProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  const handleConfirm = () => {
    if (!reason.trim()) {
      setError("Le motif de l'écart est obligatoire");
      return;
    }
    setError("");
    onConfirm(reason.trim());
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Fin de service — Motif d'écart"
      description="Un écart est constaté par rapport à votre fin de service prévue."
    >
      <div className="flex flex-col gap-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-900 flex flex-col gap-1">
          {scheduledEndTime && (
            <div className="flex justify-between">
              <span>Fin prévue au planning :</span>
              <span className="font-bold">{formatTime(scheduledEndTime)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Heure réelle de pointage :</span>
            <span className="font-semibold">{formatTime(rawTime)}</span>
          </div>
          <div className="flex justify-between border-t border-amber-200/60 pt-1 mt-1 text-emerald-800">
            <span>Arrondi au quart d&apos;heure légal :</span>
            <span className="font-bold">{formatTime(roundedTime)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="discrepancy-reason"
            className="text-sm font-semibold text-gray-700"
          >
            Motif de la prolongation ou de l&apos;écart (obligatoire) :
          </label>
          <textarea
            id="discrepancy-reason"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError("");
            }}
            placeholder="Ex : Coup de feu en salle, nettoyage approfondi en cuisine..."
            rows={3}
            className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1"
          >
            Annuler
          </Button>
          <Button
            variant="default"
            onClick={handleConfirm}
            disabled={isLoading}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
          >
            {isLoading ? "Enregistrement..." : "Confirmer le pointage"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
