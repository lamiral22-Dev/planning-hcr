"use client";

import React from "react";
import { format, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import { ManagerShiftBadge } from "./manager-shift-badge";
import { isOvernightTime, toAppTime } from "@/lib/time-utils";
import type { MasterTemplateItem } from "./master-template-modal";
import { calculateWeeklyHours } from "@/lib/hcr-rules";
import { addDays } from "date-fns";
import { fromAppTime } from "@/lib/time-utils";
import { getFrenchPublicHolidays } from "@/lib/french-holidays";

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
  isActive?: boolean;
}

interface PlanningGridTableProps {
  days: Date[];
  employees: PlanningEmployee[];
  shifts: PlanningShift[];
  onSelectShift?: (shift: PlanningShift) => void;
  onAddShift?: (employeeId: string, day: Date) => void;
  templates?: MasterTemplateItem[];
  selectedTemplateId?: string | null;
  onSelectTemplate?: (id: string) => void;
  onAddTemplate?: () => void;
  onPlaceTemplate?: (templateId: string, employeeId: string, day: Date) => void;
  isPlacing?: boolean;
  readOnly?: boolean;
  leaves?: { id: string; userId: string; type: string; status: string; startDate: string; endDate: string }[];
}

export function PlanningGridTable({
  days,
  employees,
  shifts,
  onSelectShift,
  onAddShift,
  templates = [],
  selectedTemplateId,
  onSelectTemplate,
  onAddTemplate,
  onPlaceTemplate,
  isPlacing = false,
  readOnly = false,
  leaves = [],
}: PlanningGridTableProps) {
  // Calculer les heures travaillées par collaborateur sur la quinzaine
  const getEmployeeStats = (empId: string) => {
    const empShifts = shifts.filter((s) => s.userId === empId && s.status !== "ANNULE").map((s) => ({
      startTime: new Date(s.startTime),
      endTime: new Date(s.endTime),
    }));
    let totalMinutes = 0;
    const periodStart = fromAppTime(days[0]).getTime();
    const periodEnd = fromAppTime(addDays(days[days.length - 1], 1)).getTime();

    // Découpage en 2 semaines (jours 0-6 et 7-13)
    empShifts.forEach((s) => {
      const start = new Date(s.startTime);
      const end = new Date(s.endTime);
      const diffMin = Math.max(0, (Math.min(end.getTime(), periodEnd) - Math.max(start.getTime(), periodStart)) / (1000 * 60));
      totalMinutes += diffMin;
    });

    return {
      totalHours: (totalMinutes / 60).toFixed(1),
      isOver48h: [days[0], days[7]].some((day) => day && calculateWeeklyHours(empShifts, fromAppTime(day)) > 48),
    };
  };

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm print:border-none print:shadow-none print:overflow-visible print:max-w-full">
      <table className="w-full text-left border-collapse min-w-[1200px] print:min-w-0 print:w-full print:text-[10px]">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-xs print:text-[10px] text-slate-700">
            <th className="p-3 print:p-1 w-48 print:w-auto font-bold border-r border-slate-200 sticky left-0 bg-slate-50 z-10 print:static">
              Collaborateur
            </th>
            {days.map((day, idx) => (
              <th
                key={idx}
                className={`p-2 print:p-1 text-center border-r border-slate-200 font-semibold min-w-[75px] print:min-w-0 ${
                  idx === 6 || idx === 13 ? "bg-slate-100" : ""
                }`}
              >
                <div className="capitalize">{format(day, "EEE", { locale: fr })}</div>
                <div className="text-slate-500 font-normal print:text-[9px]">{format(day, "dd/MM")}</div>
                {getFrenchPublicHolidays(day.getFullYear()).filter((holiday) => holiday.date === format(day, "yyyy-MM-dd")).map((holiday) =>
                  <div key={holiday.date} className="text-[10px] font-medium text-amber-700">Férié · {holiday.name}</div>)}
              </th>
            ))}
            <th className="p-3 print:p-1 text-center font-bold min-w-[80px] print:min-w-0">Total 15j</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-xs print:text-[10px]">
          {!readOnly && <tr className="bg-blue-50 print:hidden">
            <th className="p-3 border-r border-slate-200 sticky left-0 bg-blue-50 z-10">Créneaux du restaurant</th>
            <td colSpan={days.length + 1} className="p-2">
              <div className="flex flex-wrap gap-2 items-center">
                {templates.filter((t) => t.isActive).map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    draggable
                    aria-pressed={selectedTemplateId === template.id}
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", template.id);
                      event.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => onSelectTemplate?.(template.id)}
                    className={`rounded border px-2 py-1 bg-white ${selectedTemplateId === template.id ? "border-blue-600 ring-2 ring-blue-300" : "border-slate-300"}`}
                  >
                    {template.name} {template.startTime} - {template.endTime}{isOvernightTime(template.startTime, template.endTime) ? " +1j" : ""}
                  </button>
                ))}
                {templates.filter((t) => t.isActive).length === 0 && <span>Aucun créneau actif.</span>}
                <button type="button" onClick={onAddTemplate} className="rounded border border-blue-400 px-2 py-1 text-blue-700">+ Ajouter un créneau</button>
                {selectedTemplateId && <span>Sélectionnez une case pour affecter ce créneau.</span>}
              </div>
            </td>
          </tr>}
          {employees.map((emp) => {
            const stats = getEmployeeStats(emp.id);
            const isArchived = emp.isActive === false;
            return (
              <tr
                key={emp.id}
                className={`hover:bg-slate-50/50 transition-colors print:break-inside-avoid ${
                  isArchived ? "bg-slate-50/40 opacity-80" : ""
                }`}
              >
                {/* Nom & Métier */}
                <td className="p-3 print:p-1 font-medium text-slate-900 border-r border-slate-200 sticky left-0 bg-white z-10 print:static">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span>{emp.name}</span>
                    {isArchived && (
                      <span className="text-[9px] uppercase px-1 py-0.2 bg-slate-200 text-slate-600 rounded font-normal">
                        Archivé
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] print:text-[9px] text-slate-500">{emp.role}</div>
                </td>

                {/* 14 Colonnes de Jours */}
                {days.map((day, dIdx) => {
                  const dayShifts = shifts.filter(
                    (s) =>
                      s.userId === emp.id &&
                      s.status !== "ANNULE" &&
                      isSameDay(toAppTime(new Date(s.startTime)), day)
                  );
                  const key = format(day, "yyyy-MM-dd");
                  const dayLeaves = leaves.filter((leave) =>
                    leave.userId === emp.id && leave.startDate <= key && leave.endDate >= key
                  );

                  return (
                    <td
                      key={dIdx}
                      onDragOver={(event) => {
                        if (!readOnly && !isArchived && !isPlacing) event.preventDefault();
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const id = event.dataTransfer.getData("text/plain");
                        if (!readOnly && !isArchived && !isPlacing && templates.some((t) => t.id === id && t.isActive)) {
                          onPlaceTemplate?.(id, emp.id, day);
                        }
                      }}
                      className={`p-1.5 print:p-0.5 align-top border-r border-slate-200 h-20 print:h-auto ${
                        dIdx === 6 || dIdx === 13 ? "bg-slate-50/50" : ""
                      }`}
                    >
                      {dayShifts.length > 0 || dayLeaves.length > 0 ? (
                        <div className="space-y-1 print:space-y-0.5">
                          {dayLeaves.map((leave) => <div key={leave.id} className={`rounded border p-1 font-semibold ${leave.status === "APPROUVE" ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-orange-300 bg-orange-50 text-orange-900"}`}>
                            {leave.type === "AUTRE_MOTIF" ? "CP autre motif" : leave.type}{leave.status === "EN_ATTENTE" ? " (Demandé)" : ""}
                          </div>)}
                          {dayShifts.map((shift) => {
                            const start = toAppTime(new Date(shift.startTime));
                            const end = toAppTime(new Date(shift.endTime));
                            const startStr = format(start, "HH:mm");
                            const endStr = format(end, "HH:mm");
                            return (
                              <button
                                key={shift.id}
                                onClick={readOnly ? undefined : () => onSelectShift?.(shift)}
                                disabled={readOnly}
                                className="w-full text-left p-1 print:p-0.5 rounded bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors print:bg-slate-50 print:border-slate-300"
                              >
                                <div className="font-semibold text-blue-900 print:text-[9px]">
                                  {startStr} - {endStr}{!isSameDay(start, end) ? " +1j" : ""}
                                </div>
                                <ManagerShiftBadge
                                  status={shift.status}
                                  isLate={shift.isLateModification}
                                />
                              </button>
                            );
                          })}
                          {!readOnly && !isArchived && selectedTemplateId && (
                            <button type="button" disabled={isPlacing} onClick={() => onPlaceTemplate?.(selectedTemplateId, emp.id, day)} className="w-full text-blue-700 print:hidden">+ Affecter</button>
                          )}
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          {!readOnly && !isArchived ? (
                            <button
                              disabled={isPlacing}
                              onClick={() => selectedTemplateId ? onPlaceTemplate?.(selectedTemplateId, emp.id, day) : onAddShift?.(emp.id, day)}
                              className="text-slate-300 hover:text-blue-600 hover:bg-blue-50 w-full h-full rounded flex items-center justify-center font-bold text-base transition-colors print:hidden"
                              title={selectedTemplateId ? "Affecter le créneau sélectionné" : "Ajouter un shift"}
                            >
                              +
                            </button>
                          ) : (
                            <span className="text-slate-300 text-xs print:hidden">-</span>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}

                {/* Total Heures */}
                <td className="p-3 print:p-1 text-center align-middle font-bold">
                  <span className={stats.isOver48h ? "text-rose-600" : "text-slate-800"}>
                    {stats.totalHours}h
                  </span>
                  {stats.isOver48h && (
                    <div className="text-[10px] print:text-[8px] text-rose-600 font-semibold">
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
