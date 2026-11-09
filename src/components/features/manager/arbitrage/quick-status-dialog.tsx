"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { recordOperationalStatus } from "@/actions/time-actions";
import type { QualificationStatus } from "@prisma/client";

interface QuickStatusDialogProps {
  isOpen: boolean;
  onClose: () => void;
  shiftId: string;
  employeeName: string;
  onSuccess: () => void;
}

export function QuickStatusDialog({
  isOpen,
  onClose,
  shiftId,
  employeeName,
  onSuccess,
}: QuickStatusDialogProps) {
  const [selectedStatus, setSelectedStatus] =
    useState<QualificationStatus>("ABSENT_INJUSTIFIE");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const res = await recordOperationalStatus(
      shiftId,
      selectedStatus,
      reason.trim() || undefined
    );

    if (res.success) {
      setIsSubmitting(false);
      onSuccess();
      onClose();
    } else {
      setError(res.error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-slate-900">
            Qualifier un imprévu sans pointage
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold text-xl"
          >
            ×
          </button>
        </div>

        <p className="text-xs text-slate-600 mb-4">
          Salarié concerné : <strong>{employeeName}</strong>. Enregistre une absence à 0h neutralisée en paie.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Statut Opérationnel (0h comptabilisées)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Absent injustifié", value: "ABSENT_INJUSTIFIE" },
                { label: "Maladie (0h)", value: "MALADIE" },
                { label: "Vacances (0h)", value: "VACANCES" },
                { label: "Retard constaté", value: "RETARD" },
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setSelectedStatus(opt.value as QualificationStatus)}
                  className={`p-2 rounded-lg text-xs font-semibold border transition-colors ${
                    selectedStatus === opt.value
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Motif / Commentaire (optionnel)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Salarié injoignable par téléphone"
              className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
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
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
            >
              {isSubmitting ? "Enregistrement..." : "Appliquer le statut"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
