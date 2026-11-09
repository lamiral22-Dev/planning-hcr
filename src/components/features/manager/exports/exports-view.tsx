"use client";

import React, { useState } from "react";
import { PayrollPeriodSelector } from "./payroll-period-selector";
import { PayrollSummaryCard } from "./payroll-summary-card";
import { Button } from "@/components/ui/button";

interface ExportsViewProps {
  initialSummary?: {
    totalHours: number;
    totalAbsences: number;
    totalEmployees: number;
  };
}

export function ExportsView({ initialSummary }: ExportsViewProps) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const handleSetCurrentMonth = () => {
    const today = new Date();
    setMonth(today.getMonth() + 1);
    setYear(today.getFullYear());
  };

  const handleSetPreviousMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const downloadUrl = `/api/manager/export-paie?month=${month}&year=${year}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Export Paie Conforme HCR
        </h1>
        <p className="text-sm text-slate-500">
          Génération de fichiers CSV (séparateur point-virgule &apos;;&apos;, UTF-8 BOM, 7 colonnes réglementaires).
        </p>
      </div>

      <PayrollPeriodSelector
        month={month}
        year={year}
        onChangeMonth={setMonth}
        onChangeYear={setYear}
        onSetCurrentMonth={handleSetCurrentMonth}
        onSetPreviousMonth={handleSetPreviousMonth}
      />

      <PayrollSummaryCard
        month={month}
        year={year}
        totalHours={initialSummary?.totalHours ?? 0}
        totalAbsences={initialSummary?.totalAbsences ?? 0}
        totalEmployees={initialSummary?.totalEmployees ?? 0}
      />

      <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Fichier d&apos;export mensuel
          </h3>
          <p className="text-xs text-slate-500">
            Fichier : export-paie-{String(month).padStart(2, "0")}-{year}.csv
          </p>
        </div>

        <a href={downloadUrl} download>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-2">
            📥 Télécharger le CSV Paie Conforme
          </Button>
        </a>
      </div>
    </div>
  );
}
