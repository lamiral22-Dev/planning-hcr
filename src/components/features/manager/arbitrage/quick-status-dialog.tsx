"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  recordOperationalStatus,
  recordMissedClockIn,
} from "@/actions/time-actions";
import type { QualificationStatus } from "@prisma/client";

interface QuickStatusDialogProps {
  isOpen: boolean;
  onClose: () => void;
  shiftId: string;
  employeeName: string;
  plannedStartTime?: string | Date;
  plannedEndTime?: string | Date;
  onSuccess: () => void;
}

type ModeType = "ZERO_HOUR" | "MISSED_CLOCK_IN";

export function QuickStatusDialog({
  isOpen,
  onClose,
  shiftId,
  employeeName,
  plannedStartTime,
  plannedEndTime,
  onSuccess,
}: QuickStatusDialogProps) {
  const [mode, setMode] = useState<ModeType>("ZERO_HOUR");
  const [selectedStatus, setSelectedStatus] =
    useState<QualificationStatus>("ABSENT_INJUSTIFIE");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialisation des heures réelles avec les horaires du shift planifié
  const defaultStartStr = plannedStartTime
    ? new Date(plannedStartTime).toTimeString().slice(0, 5)
    : "12:00";
  const defaultEndStr = plannedEndTime
    ? new Date(plannedEndTime).toTimeString().slice(0, 5)
    : "15:00";

  const [actualStartTimeStr, setActualStartTimeStr] = useState(defaultStartStr);
  const [actualEndTimeStr, setActualEndTimeStr] = useState(defaultEndStr);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (mode === "MISSED_CLOCK_IN") {
      if (!reason.trim()) {
        setError("Le motif de régularisation est obligatoire pour un oubli de pointage.");
        setIsSubmitting(false);
        return;
      }

      // Reconstruire les Date effectives
      const baseDate = plannedStartTime ? new Date(plannedStartTime) : new Date();
      const baseDateStr = baseDate.toISOString().slice(0, 10);

      const finalStart = new Date(`${baseDateStr}T${actualStartTimeStr}:00`);
      let finalEnd = new Date(`${baseDateStr}T${actualEndTimeStr}:00`);
      if (finalEnd <= finalStart) {
        finalEnd = new Date(finalEnd.getTime() + 24 * 60 * 60 * 1000);
      }

      const res = await recordMissedClockIn({
        shiftId,
        actualStartTime: finalStart,
        actualEndTime: finalEnd,
        reason: reason.trim(),
      });

      if (res.success) {
        setIsSubmitting(false);
        onSuccess();
        onClose();
      } else {
        setError(res.error);
        setIsSubmitting(false);
      }
    } else {
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
          Salarié concerné : <strong>{employeeName}</strong>.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Choix de la modalité : Absence 0h vs Oubli de pointage */}
        <div className="flex rounded-lg border border-slate-200 p-1 bg-slate-50 mb-4">
          <button
            type="button"
            onClick={() => setMode("ZERO_HOUR")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              mode === "ZERO_HOUR"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Absence / Imprévu (0h)
          </button>
          <button
            type="button"
            onClick={() => setMode("MISSED_CLOCK_IN")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              mode === "MISSED_CLOCK_IN"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            🕒 Oubli de pointage (heures réelles)
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "ZERO_HOUR" ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Statut Opérationnel (0h comptabilisées en paie)
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
          ) : (
            <div className="space-y-3 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
              <p className="text-xs text-blue-800">
                Saisissez les heures réellement accomplies par le salarié. Les horaires prévus sont pré-remplis par défaut.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Heure début effective
                  </label>
                  <input
                    type="time"
                    required
                    value={actualStartTimeStr}
                    onChange={(e) => setActualStartTimeStr(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Heure fin effective
                  </label>
                  <input
                    type="time"
                    required
                    value={actualEndTimeStr}
                    onChange={(e) => setActualEndTimeStr(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                * L&apos;heure de fin fera l&apos;objet d&apos;un arrondi automatique au quart d&apos;heure réglementaire HCR.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Motif de régularisation {mode === "MISSED_CLOCK_IN" ? "(obligatoire)" : "(optionnel)"}
            </label>
            <textarea
              value={reason}
              required={mode === "MISSED_CLOCK_IN"}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                mode === "MISSED_CLOCK_IN"
                  ? "Ex: Oubli de badger, présence attestée par le responsable de salle"
                  : "Ex: Salarié injoignable par téléphone"
              }
              className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
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
