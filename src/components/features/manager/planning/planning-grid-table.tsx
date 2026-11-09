"use client";

import React from "react";
import { format, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import { ManagerShiftBadge } from "./manager-shift-badge";

export interface PlanningShift {
  id: string;
  userId: string;
  startTime: Date | string;
  endTime: Date | string;
  status: "BROUILLON" | "PUBLIE" | "EN_ATTENTE_DEROGATION" | "ANNULE";
  isLateModification?: boolean;
}

export interface PlanningEmployee {
  id: string;
  name: string;
  role: string;
}

interface PlanningGridTableProps {
  days: Date[];
  employees: PlanningEmployee[];
  shifts: PlanningShift[];
  onSelectShift?: (shift: PlanningShift) => void;
  onAddShift?: (employeeId: string, day: Date) => void;
}

export function PlanningGridTable({
  days,
  employees,
  shifts,
  onSelectShift,
  onAddShift,
}: PlanningGridTableProps) {
  // Calculer les heures travaillées par collaborateur sur la quinzaine
  const getEmployeeStats = (empId: string) => {
    const empShifts = shifts.filter((s) => s.userId === empId && s.status !== "ANNULE");
    let totalMinutes = 0;

    // Découpage en 2 semaines (jours 0-6 et 7-13)
    empShifts.forEach((s) => {
      const start = new Date(s.startTime);
      const end = new Date(s.endTime);
      const diffMin = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60));
      totalMinutes += diffMin;
    });

    return {
      totalHours: (totalMinutes / 60).toFixed(1),
      isOver48h: totalMinutes / 60 > 48,
    };
  };

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm print:border-none print:shadow-none">
      <table className="w-full text-left border-collapse min-w-[1200px] print:min-w-full">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-700">
            <th className="p-3 w-48 font-bold border-r border-slate-200 sticky left-0 bg-slate-50 z-10 print:static">
              Collaborateur
            </th>
            {days.map((day, idx) => (
              <th
                key={idx}
                className={`p-2 text-center border-r border-slate-200 font-semibold min-w-[75px] ${
                  idx === 6 || idx === 13 ? "bg-slate-100" : ""
                }`}
              >
                <div className="capitalize">{format(day, "EEE", { locale: fr })}</div>
                <div className="text-slate-500 font-normal">{format(day, "dd/MM")}</div>
              </th>
            ))}
            <th className="p-3 text-center font-bold min-w-[80px]">Total 15j</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-xs">
          {employees.map((emp) => {
            const stats = getEmployeeStats(emp.id);
            return (
              <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                {/* Nom & Métier */}
                <td className="p-3 font-medium text-slate-900 border-r border-slate-200 sticky left-0 bg-white z-10 print:static">
                  <div className="font-bold">{emp.name}</div>
                  <div className="text-[11px] text-slate-500">{emp.role}</div>
                </td>

                {/* 14 Colonnes de Jours */}
                {days.map((day, dIdx) => {
                  const dayShifts = shifts.filter(
                    (s) =>
                      s.userId === emp.id &&
                      s.status !== "ANNULE" &&
                      isSameDay(new Date(s.startTime), day)
                  );

                  return (
                    <td
                      key={dIdx}
                      className={`p-1.5 align-top border-r border-slate-200 h-20 ${
                        dIdx === 6 || dIdx === 13 ? "bg-slate-50/50" : ""
                      }`}
                    >
                      {dayShifts.length > 0 ? (
                        <div className="space-y-1">
                          {dayShifts.map((shift) => {
                            const startStr = format(new Date(shift.startTime), "HH:mm");
                            const endStr = format(new Date(shift.endTime), "HH:mm");
                            return (
                              <button
                                key={shift.id}
                                onClick={() => onSelectShift?.(shift)}
                                className="w-full text-left p-1 rounded bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
                              >
                                <div className="font-semibold text-blue-900">
                                  {startStr} - {endStr}
                                </div>
                                <ManagerShiftBadge
                                  status={shift.status}
                                  isLate={shift.isLateModification}
                                />
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <button
                            onClick={() => onAddShift?.(emp.id, day)}
                            className="text-slate-300 hover:text-blue-600 hover:bg-blue-50 w-full h-full rounded flex items-center justify-center font-bold text-base transition-colors print:hidden"
                            title="Ajouter un shift"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </td>
                  );
                })}

                {/* Total Heures */}
                <td className="p-3 text-center align-middle font-bold">
                  <span className={stats.isOver48h ? "text-rose-600" : "text-slate-800"}>
                    {stats.totalHours}h
                  </span>
                  {stats.isOver48h && (
                    <div className="text-[10px] text-rose-600 font-semibold">
                      ⚠️ &gt; 48h/sem.
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
