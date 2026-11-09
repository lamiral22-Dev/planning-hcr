"use client";

import React, { useState } from "react";
import { addDays, startOfWeek, format } from "date-fns";
import { fr } from "date-fns/locale";
import { PlanningToolbar } from "./planning-toolbar";
import { PlanningGridTable, type PlanningShift, type PlanningEmployee } from "./planning-grid-table";
import { ShiftFormModal } from "./shift-form-modal";
import { Skeleton } from "@/components/ui/skeleton";

interface PlanningQuinzaineViewProps {
  initialShifts: PlanningShift[];
  employees: PlanningEmployee[];
  isLoading?: boolean;
}

export function PlanningQuinzaineView({
  initialShifts,
  employees,
  isLoading = false,
}: PlanningQuinzaineViewProps) {
  // Navigation de la quinzaine (commence le lundi)
  const [startDate, setStartDate] = useState<Date>(() => {
    return startOfWeek(new Date(), { weekStartsOn: 1 });
  });

  const [shifts] = useState<PlanningShift[]>(initialShifts);
  const [, setSelectedShift] = useState<PlanningShift | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalInitialData, setModalInitialData] = useState<{
    id?: string;
    userId: string;
    startTime: Date;
    endTime: Date;
  } | undefined>(undefined);

  // 14 jours de la quinzaine
  const days = Array.from({ length: 14 }).map((_, idx) => addDays(startDate, idx));
  const endDate = days[13];

  const handlePrevQuinzaine = () => {
    setStartDate((prev) => addDays(prev, -14));
  };

  const handleNextQuinzaine = () => {
    setStartDate((prev) => addDays(prev, 14));
  };

  const handleOpenCreateModal = () => {
    setModalInitialData(undefined);
    setIsModalOpen(true);
  };

  const handleAddShiftAt = (employeeId: string, day: Date) => {
    const start = new Date(day);
    start.setHours(9, 0, 0, 0);
    const end = new Date(day);
    end.setHours(17, 0, 0, 0);

    setModalInitialData({
      userId: employeeId,
      startTime: start,
      endTime: end,
    });
    setIsModalOpen(true);
  };

  const handleSelectShift = (shift: PlanningShift) => {
    setSelectedShift(shift);
    setModalInitialData({
      id: shift.id,
      userId: shift.userId,
      startTime: new Date(shift.startTime),
      endTime: new Date(shift.endTime),
    });
    setIsModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Styles d'impression A4/A3 Paysage */}
      <style jsx global>{`
        @media print {
          @page {
            size: landscape;
            margin: 1cm;
          }
          body {
            background: white !important;
            color: black !important;
          }
        }
      `}</style>

      {/* Titre et Navigation Quinzaine */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Planning Quinzaine
          </h1>
          <p className="text-sm text-slate-500">
            Période du {format(startDate, "dd MMMM yyyy", { locale: fr })} au{" "}
            {format(endDate, "dd MMMM yyyy", { locale: fr })}
          </p>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <button
            onClick={handlePrevQuinzaine}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            ← Quinzaine précédente
          </button>
          <button
            onClick={handleNextQuinzaine}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Quinzaine suivante →
          </button>
        </div>
      </div>

      {/* Barre d'outils d'action */}
      <PlanningToolbar
        startDate={startDate}
        endDate={endDate}
        onOpenCreateModal={handleOpenCreateModal}
        onRefresh={() => {
          // Rechargement simple
          window.location.reload();
        }}
      />

      {/* Table quinzaine ou Empty State */}
      {employees.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500 text-sm">
            Aucun salarié enregistré dans l&apos;établissement.
          </p>
        </div>
      ) : (
        <PlanningGridTable
          days={days}
          employees={employees}
          shifts={shifts}
          onSelectShift={handleSelectShift}
          onAddShift={handleAddShiftAt}
        />
      )}

      {/* Modal de création / édition */}
      <ShiftFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        employees={employees}
        initialData={modalInitialData}
        onSuccess={() => {
          window.location.reload();
        }}
      />
    </div>
  );
}
