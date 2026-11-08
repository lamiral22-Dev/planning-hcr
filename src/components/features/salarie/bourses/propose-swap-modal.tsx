"use client";

import React, { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface Colleague {
  id: string;
  name: string;
}

export interface UserShiftOption {
  id: string;
  label: string;
}

export interface ProposeSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: { shiftId: string; targetUserId: string; reason?: string }) => void;
  myShifts: UserShiftOption[];
  colleagues: Colleague[];
  initialShiftId?: string | null;
  isLoading?: boolean;
}

export function ProposeSwapModal({
  isOpen,
  onClose,
  onConfirm,
  myShifts,
  colleagues,
  initialShiftId,
  isLoading,
}: ProposeSwapModalProps) {
  const [selectedShiftId, setSelectedShiftId] = useState(
    initialShiftId ?? myShifts[0]?.id ?? ""
  );
  const [selectedColleagueId, setSelectedColleagueId] = useState(
    colleagues[0]?.id ?? ""
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const handleConfirm = () => {
    if (!selectedShiftId) {
      setError("Veuillez sélectionner un créneau.");
      return;
    }
    if (!selectedColleagueId) {
      setError("Veuillez sélectionner un collègue.");
      return;
    }
    setError("");
    onConfirm({
      shiftId: selectedShiftId,
      targetUserId: selectedColleagueId,
      reason: reason.trim() ? reason.trim() : undefined,
    });
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Proposer mon shift à l'échange"
      description="Sélectionnez le créneau à échanger et le collègue sollicité."
    >
      <div className="flex flex-col gap-4">
        {/* Choix du créneau */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="select-shift" className="text-sm font-semibold text-gray-700">
            Mon shift à échanger :
          </label>
          <select
            id="select-shift"
            value={selectedShiftId}
            onChange={(e) => setSelectedShiftId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 p-2.5 text-sm bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            {myShifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Choix du collègue */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="select-colleague" className="text-sm font-semibold text-gray-700">
            Collègue repreneur :
          </label>
          <select
            id="select-colleague"
            value={selectedColleagueId}
            onChange={(e) => setSelectedColleagueId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 p-2.5 text-sm bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            {colleagues.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Motif optionnel */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="swap-reason" className="text-sm font-semibold text-gray-700">
            Motif de la demande :
          </label>
          <textarea
            id="swap-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex : Rendez-vous médical, contrainte familiale..."
            rows={2}
            className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading} className="flex-1">
            Annuler
          </Button>
          <Button
            variant="default"
            onClick={handleConfirm}
            disabled={isLoading || myShifts.length === 0}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? "Envoi..." : "Envoyer la demande"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
