"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { createShift, updateShift } from "@/actions/shift-actions";
import { checkNoticePeriod } from "@/lib/hcr-rules";

interface EmployeeOption {
  id: string;
  name: string;
}

interface ShiftFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: EmployeeOption[];
  initialData?: {
    id?: string;
    userId: string;
    startTime: Date;
    endTime: Date;
  };
  onSuccess: () => void;
}

export function ShiftFormModal({
  isOpen,
  onClose,
  employees,
  initialData,
  onSuccess,
}: ShiftFormModalProps) {
  const [userId, setUserId] = useState<string>("");
  const [dateStr, setDateStr] = useState<string>("");
  const [startTimeStr, setStartTimeStr] = useState<string>("09:00");
  const [endTimeStr, setEndTimeStr] = useState<string>("17:00");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLate, setIsLate] = useState(false);

  useEffect(() => {
    if (initialData) {
      setUserId(initialData.userId);
      const d = new Date(initialData.startTime);
      setDateStr(d.toISOString().slice(0, 10));
      setStartTimeStr(d.toTimeString().slice(0, 5));
      const endD = new Date(initialData.endTime);
      setEndTimeStr(endD.toTimeString().slice(0, 5));
    } else {
      if (employees.length > 0) setUserId(employees[0].id);
      const today = new Date();
      setDateStr(today.toISOString().slice(0, 10));
      setStartTimeStr("09:00");
      setEndTimeStr("17:00");
    }
  }, [initialData, employees, isOpen]);

  // Détection dynamique J < 8
  useEffect(() => {
    if (dateStr && startTimeStr) {
      const shiftStart = new Date(`${dateStr}T${startTimeStr}:00`);
      if (!isNaN(shiftStart.getTime())) {
        const check = checkNoticePeriod(shiftStart, new Date());
        setIsLate(check.requiresDerogation);
      }
    }
  }, [dateStr, startTimeStr]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const start = new Date(`${dateStr}T${startTimeStr}:00`);
      let end = new Date(`${dateStr}T${endTimeStr}:00`);
      if (end <= start) {
        end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
      }

      if (initialData?.id) {
        const res = await updateShift(initialData.id, {
          userId,
          startTime: start,
          endTime: end,
        });
        if (!res.success) {
          setError(res.error);
          setIsSubmitting(false);
          return;
        }
      } else {
        const res = await createShift({
          userId,
          startTime: start,
          endTime: end,
          status: "BROUILLON",
          isLateModification: false,
          planningVersion: 1,
        });
        if (!res.success) {
          setError(res.error);
          setIsSubmitting(false);
          return;
        }
      }

      setIsSubmitting(false);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 overflow-hidden">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-slate-900">
            {initialData?.id ? "Modifier le shift" : "Créer un shift"}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl font-bold"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {isLate && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            ⚠️ <strong>Délai de prévenance &lt; 8 jours :</strong> Ce shift nécessitera un accord dérogatoire exprès du salarié.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Collaborateur
            </label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Date
            </label>
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Heure de début
              </label>
              <input
                type="time"
                value={startTimeStr}
                onChange={(e) => setStartTimeStr(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Heure de fin
              </label>
              <input
                type="time"
                value={endTimeStr}
                onChange={(e) => setEndTimeStr(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
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
              {isSubmitting ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
