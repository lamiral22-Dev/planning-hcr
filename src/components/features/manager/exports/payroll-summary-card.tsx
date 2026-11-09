"use client";

import React from "react";

interface PayrollSummaryCardProps {
  totalHours: number;
  totalAbsences: number;
  totalEmployees: number;
  month: number;
  year: number;
}

export function PayrollSummaryCard({
  totalHours,
  totalAbsences,
  totalEmployees,
  month,
  year,
}: PayrollSummaryCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
      <h2 className="text-base font-bold text-slate-900 mb-4">
        Aperçu des Heures — {String(month).padStart(2, "0")}/{year}
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
            Total Heures Travaillées
          </p>
          <p className="text-2xl font-black text-blue-950 mt-1">
            {totalHours.toFixed(2)} h
          </p>
          <p className="text-[11px] text-blue-600 mt-1">Arrondies selon règles HCR</p>
        </div>

        <div className="p-4 bg-amber-50 rounded-lg border border-amber-100">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
            Absences Neutralisées (0h)
          </p>
          <p className="text-2xl font-black text-amber-950 mt-1">
            {totalAbsences}
          </p>
          <p className="text-[11px] text-amber-600 mt-1">Injustifiées, Maladie, Vacances</p>
        </div>

        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Salariés Concernés
          </p>
          <p className="text-2xl font-black text-slate-950 mt-1">
            {totalEmployees}
          </p>
          <p className="text-[11px] text-slate-600 mt-1">Sur la période mensuelle</p>
        </div>
      </div>
    </div>
  );
}
