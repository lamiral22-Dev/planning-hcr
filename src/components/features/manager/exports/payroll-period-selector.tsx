"use client";

import React from "react";
import { Button } from "@/components/ui/button";

interface PayrollPeriodSelectorProps {
  month: number;
  year: number;
  onChangeMonth: (m: number) => void;
  onChangeYear: (y: number) => void;
  onSetCurrentMonth: () => void;
  onSetPreviousMonth: () => void;
}

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

export function PayrollPeriodSelector({
  month,
  year,
  onChangeMonth,
  onChangeYear,
  onSetCurrentMonth,
  onSetPreviousMonth,
}: PayrollPeriodSelectorProps) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Mois
          </label>
          <select
            value={month}
            onChange={(e) => onChangeMonth(Number(e.target.value))}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {MONTHS.map((mName, idx) => (
              <option key={idx + 1} value={idx + 1}>
                {mName} ({String(idx + 1).padStart(2, "0")})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Année
          </label>
          <select
            value={year}
            onChange={(e) => onChangeYear(Number(e.target.value))}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onSetPreviousMonth}
          className="text-xs"
        >
          Mois précédent
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onSetCurrentMonth}
          className="text-xs"
        >
          Mois en cours
        </Button>
      </div>
    </div>
  );
}
