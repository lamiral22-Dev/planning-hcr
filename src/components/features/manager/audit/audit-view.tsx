"use client";

import React, { useState, useTransition } from "react";
import { AuditTable } from "./audit-table";
import { AuditDrawer } from "./audit-drawer";
import { Button } from "@/components/ui/button";
import { getAuditLogs, type AuditLogItem } from "@/actions/audit-actions";
import { ShieldCheck, Download, RefreshCw, Filter } from "lucide-react";

interface AuditUserOption {
  id: string;
  name: string;
  matricule: string;
}

interface AuditViewProps {
  initialLogs: AuditLogItem[];
  totalCount: number;
  users: AuditUserOption[];
}

const COMMON_ACTIONS = [
  "SHIFT_CREATED",
  "SHIFT_UPDATED",
  "SHIFT_ACKNOWLEDGED",
  "DEROGATION_ACCEPTED",
  "TIME_ENTRY_ARBITRATED",
  "MISSED_CLOCK_IN_RECORDED",
  "MISSED_CLOCK_IN_UPDATED",
  "CLOCK_IN",
  "CLOCK_OUT",
  "USER_CREATED",
  "USER_UPDATED",
  "USER_DEACTIVATED",
  "USER_ACTIVATED",
  "QUINZAINE_PUBLISHED",
  "MASTER_TEMPLATE_APPLIED",
];

export function AuditView({ initialLogs, totalCount: initialTotal, users }: AuditViewProps) {
  const [logs, setLogs] = useState<AuditLogItem[]>(initialLogs);
  const [totalCount, setTotalCount] = useState<number>(initialTotal);

  const [selectedUser, setSelectedUser] = useState<string>("ALL");
  const [selectedAction, setSelectedAction] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [isPending, startTransition] = useTransition();

  const handleFilter = () => {
    startTransition(async () => {
      const res = await getAuditLogs({
        userId: selectedUser !== "ALL" ? selectedUser : undefined,
        action: selectedAction !== "ALL" ? selectedAction : undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      });

      if (res.success) {
        setLogs(res.data.logs);
        setTotalCount(res.data.totalCount);
      }
    });
  };

  const handleResetFilters = () => {
    setSelectedUser("ALL");
    setSelectedAction("ALL");
    setStartDate("");
    setEndDate("");

    startTransition(async () => {
      const res = await getAuditLogs({});
      if (res.success) {
        setLogs(res.data.logs);
        setTotalCount(res.data.totalCount);
      }
    });
  };

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (selectedUser !== "ALL") params.append("userId", selectedUser);
    if (selectedAction !== "ALL") params.append("action", selectedAction);
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);

    const url = `/api/manager/export-audit?${params.toString()}`;
    window.location.href = url;
  };

  const handleInspectLog = (log: AuditLogItem) => {
    setSelectedLog(log);
    setIsDrawerOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* En-tête de page */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
            Registre d&apos;Audit Légal
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Journal inviolable et horodaté de conformité prud&apos;homale et Inspection du Travail.
          </p>
        </div>

        <Button
          onClick={handleExportCsv}
          className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Exporter en CSV (;)
        </Button>
      </div>

      {/* Barre de filtres légaux */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 uppercase tracking-wide">
          <Filter className="w-4 h-4 text-slate-500" />
          Filtres de recherche et d&apos;investigation
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Filtre Salarié */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Collaborateur concerné / Auteur
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Tous les collaborateurs</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.matricule})
                </option>
              ))}
            </select>
          </div>

          {/* Filtre Action */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Type d&apos;action
            </label>
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            >
              <option value="ALL">Toutes les actions</option>
              {COMMON_ACTIONS.map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
          </div>

          {/* Date de début */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Date début
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Date de fin */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Date fin
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-slate-100">
          <div className="text-xs text-slate-500 font-medium">
            {totalCount} événement{totalCount > 1 ? "s" : ""} enregistré{totalCount > 1 ? "s" : ""}
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              disabled={isPending}
            >
              Réinitialiser
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleFilter}
              disabled={isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />
              Appliquer les filtres
            </Button>
          </div>
        </div>
      </div>

      {/* Table des événements */}
      <AuditTable logs={logs} onInspect={handleInspectLog} />

      {/* Tiroir d'inspection légale */}
      <AuditDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        log={selectedLog}
      />
    </div>
  );
}
