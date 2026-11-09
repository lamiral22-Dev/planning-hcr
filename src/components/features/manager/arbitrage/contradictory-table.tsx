"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { arbitrateTimeEntry } from "@/actions/time-actions";
import { QuickStatusDialog } from "./quick-status-dialog";
import type { QualificationStatus } from "@prisma/client";

export interface DiscrepancyItem {
  id: string; // TimeEntry id (ou shift id si pas de time entry)
  timeEntryId?: string;
  shiftId: string;
  employeeName: string;
  date: Date | string;
  plannedStart: Date | string;
  plannedEnd: Date | string;
  rawClockIn?: Date | string | null;
  rawClockOut?: Date | string | null;
  roundedClockOut?: Date | string | null;
  employeeReason?: string | null;
  currentQualification?: QualificationStatus;
}

interface ContradictoryTableProps {
  items: DiscrepancyItem[];
  onRefresh: () => void;
}

export function ContradictoryTable({ items, onRefresh }: ContradictoryTableProps) {
  // Ligne en cours de rectification
  const [editingId, setEditingId] = useState<string | null>(null);
  const [correctedIn, setCorrectedIn] = useState("");
  const [correctedOut, setCorrectedOut] = useState("");
  const [qualification, setQualification] =
    useState<QualificationStatus>("HEURES_MODIFIEES");
  const [arbitrationReason, setArbitrationReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialogue qualification sans pointage
  const [quickStatusTarget, setQuickStatusTarget] = useState<DiscrepancyItem | null>(null);

  const startEdit = (item: DiscrepancyItem) => {
    setEditingId(item.id);
    const inDate = item.rawClockIn ? new Date(item.rawClockIn) : new Date(item.plannedStart);
    const outDate = item.rawClockOut ? new Date(item.rawClockOut) : new Date(item.plannedEnd);

    setCorrectedIn(inDate.toTimeString().slice(0, 5));
    setCorrectedOut(outDate.toTimeString().slice(0, 5));
    setQualification("HEURES_MODIFIEES");
    setArbitrationReason("");
    setError(null);
  };

  const handleSaveArbitration = async (item: DiscrepancyItem) => {
    if (!arbitrationReason.trim()) {
      setError("Le motif de rectification managériale est obligatoire.");
      return;
    }

    if (!item.timeEntryId) {
      setError("Impossible d'arbitrer un pointage inexistant sans déclaration.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const baseDateStr = new Date(item.date).toISOString().slice(0, 10);
    const finalIn = new Date(`${baseDateStr}T${correctedIn}:00`);
    let finalOut = new Date(`${baseDateStr}T${correctedOut}:00`);
    if (finalOut <= finalIn) {
      finalOut = new Date(finalOut.getTime() + 24 * 60 * 60 * 1000);
    }

    const res = await arbitrateTimeEntry({
      timeEntryId: item.timeEntryId,
      correctedClockInTime: finalIn,
      correctedClockOutTime: finalOut,
      qualification,
      arbitrationReason: arbitrationReason.trim(),
    });

    if (res.success) {
      setIsSubmitting(false);
      setEditingId(null);
      onRefresh();
    } else {
      setError(res.error);
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500 text-sm">
        Aucun pointage en anomalie ou en attente d&apos;arbitrage.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
              <th className="p-3 font-semibold">Salarié & Date</th>
              <th className="p-3 font-semibold">Shift Planifié</th>
              <th className="p-3 font-semibold">Pointage Brut</th>
              <th className="p-3 font-semibold">Motif Salarié</th>
              <th className="p-3 font-semibold min-w-[200px]">Rectification Manager</th>
              <th className="p-3 font-semibold min-w-[180px]">Motif Rectification</th>
              <th className="p-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {items.map((item) => {
              const isEditing = editingId === item.id;
              const hasNoClocking = !item.timeEntryId;

              const planStartStr = format(new Date(item.plannedStart), "HH:mm");
              const planEndStr = format(new Date(item.plannedEnd), "HH:mm");

              const rawInStr = item.rawClockIn ? format(new Date(item.rawClockIn), "HH:mm") : "-";
              const rawOutStr = item.rawClockOut ? format(new Date(item.rawClockOut), "HH:mm") : "-";

              return (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                  {/* Salarié & Date */}
                  <td className="p-3 align-top font-medium text-slate-900">
                    <div className="font-bold">{item.employeeName}</div>
                    <div className="text-slate-500 text-[11px]">
                      {format(new Date(item.date), "dd/MM/yyyy", { locale: fr })}
                    </div>
                  </td>

                  {/* Shift planifié */}
                  <td className="p-3 align-top text-slate-700">
                    <span className="font-semibold">{planStartStr} - {planEndStr}</span>
                  </td>

                  {/* Pointage Brut */}
                  <td className="p-3 align-top">
                    {hasNoClocking ? (
                      <span className="text-rose-600 font-semibold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        Aucun pointage
                      </span>
                    ) : (
                      <div>
                        <div>Début : {rawInStr}</div>
                        <div>Fin : {rawOutStr}</div>
                        {item.roundedClockOut && (
                          <div className="text-[10px] text-slate-400">
                            Arrondi : {format(new Date(item.roundedClockOut), "HH:mm")}
                          </div>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Motif Salarié */}
                  <td className="p-3 align-top text-slate-600 italic">
                    {item.employeeReason ? `« ${item.employeeReason} »` : "-"}
                  </td>

                  {/* Rectification Manager */}
                  <td className="p-3 align-top">
                    {isEditing ? (
                      <div className="space-y-2">
                        <div className="flex gap-2 items-center">
                          <input
                            type="time"
                            value={correctedIn}
                            onChange={(e) => setCorrectedIn(e.target.value)}
                            className="border border-slate-300 rounded px-1.5 py-1 text-xs w-20"
                          />
                          <span>à</span>
                          <input
                            type="time"
                            value={correctedOut}
                            onChange={(e) => setCorrectedOut(e.target.value)}
                            className="border border-slate-300 rounded px-1.5 py-1 text-xs w-20"
                          />
                        </div>
                        <select
                          value={qualification}
                          onChange={(e) =>
                            setQualification(e.target.value as QualificationStatus)
                          }
                          className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                        >
                          <option value="HEURES_MODIFIEES">HEURES_MODIFIEES</option>
                          <option value="CONFORME">CONFORME</option>
                          <option value="RETARD">RETARD</option>
                          <option value="ABSENT_INJUSTIFIE">ABSENT_INJUSTIFIE</option>
                          <option value="MALADIE">MALADIE</option>
                          <option value="VACANCES">VACANCES</option>
                        </select>
                      </div>
                    ) : (
                      <span className="text-slate-500">
                        {item.currentQualification ?? "En attente"}
                      </span>
                    )}
                  </td>

                  {/* Motif Rectification Obligatoire */}
                  <td className="p-3 align-top">
                    {isEditing ? (
                      <textarea
                        value={arbitrationReason}
                        onChange={(e) => setArbitrationReason(e.target.value)}
                        placeholder="Motif obligatoire (traçabilité prud'homale)"
                        rows={2}
                        className="w-full border border-slate-300 rounded p-1.5 text-xs focus:ring-1 focus:ring-blue-500"
                        required
                      />
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="p-3 align-top text-right whitespace-nowrap">
                    {hasNoClocking ? (
                      <Button
                        size="sm"
                        onClick={() => setQuickStatusTarget(item)}
                        className="bg-amber-600 hover:bg-amber-700 text-white text-xs"
                      >
                        Statut Rapide (0h)
                      </Button>
                    ) : isEditing ? (
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingId(null)}
                          disabled={isSubmitting}
                        >
                          Annuler
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleSaveArbitration(item)}
                          disabled={isSubmitting}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          Enregistrer
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startEdit(item)}
                        className="text-blue-700 border-blue-200 hover:bg-blue-50"
                      >
                        Rectifier
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Dialogue rapide pour shift non pointé */}
      {quickStatusTarget && (
        <QuickStatusDialog
          isOpen={true}
          onClose={() => setQuickStatusTarget(null)}
          shiftId={quickStatusTarget.shiftId}
          employeeName={quickStatusTarget.employeeName}
          onSuccess={onRefresh}
        />
      )}
    </div>
  );
}
