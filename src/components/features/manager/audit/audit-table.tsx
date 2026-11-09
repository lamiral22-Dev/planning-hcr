"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AuditLogItem } from "@/actions/audit-actions";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { APP_TIMEZONE } from "@/lib/time-utils";
import { Eye, ShieldAlert } from "lucide-react";

interface AuditTableProps {
  logs: AuditLogItem[];
  onInspect: (log: AuditLogItem) => void;
}

export function AuditTable({ logs, onInspect }: AuditTableProps) {
  if (logs.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
        <ShieldAlert className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm text-slate-500 font-medium">
          Aucun événement d&apos;audit trouvé pour les filtres sélectionnés.
        </p>
      </div>
    );
  }

  const getActionBadgeVariant = (action: string) => {
    if (action.includes("ARBITRATED") || action.includes("DELETED") || action.includes("DEACTIVATED")) {
      return "danger";
    }
    if (action.includes("CREATED") || action.includes("ACCEPTED") || action.includes("ACTIVATED")) {
      return "success";
    }
    if (action.includes("UPDATED") || action.includes("CLOCK")) {
      return "warning";
    }
    return "secondary";
  };

  return (
    <div className="overflow-x-auto bg-white rounded-lg border border-slate-200 shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-xs uppercase tracking-wider">
          <tr>
            <th className="px-4 py-3">Horodatage (Paris)</th>
            <th className="px-4 py-3">Action Légale</th>
            <th className="px-4 py-3">Table & Cible</th>
            <th className="px-4 py-3">Auteur</th>
            <th className="px-4 py-3">Diff Avant/Après</th>
            <th className="px-4 py-3 text-right">Détails</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {logs.map((log) => {
            const zonedDate = toZonedTime(log.timestamp, APP_TIMEZONE);
            const dateStr = format(zonedDate, "dd/MM/yyyy HH:mm:ss");

            const hasPayloadOld = Boolean(log.payloadOld);
            const hasPayloadNew = Boolean(log.payloadNew);

            return (
              <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-slate-700 whitespace-nowrap">
                  {dateStr}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={getActionBadgeVariant(log.action)}>
                    {log.action}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs">
                  <span className="font-semibold text-slate-800">{log.tableName}</span>
                  <span className="font-mono text-slate-500 ml-1 truncate max-w-[120px] inline-block align-bottom" title={log.recordId}>
                    #{log.recordId}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs">
                  <div className="font-medium text-slate-900">{log.userName || "Système"}</div>
                  {log.userRole && (
                    <div className="text-[10px] text-slate-500">{log.userRole}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-xs">
                  {hasPayloadOld && hasPayloadNew ? (
                    <span className="inline-flex items-center text-xs text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      Remplacement / Modif
                    </span>
                  ) : hasPayloadNew ? (
                    <span className="inline-flex items-center text-xs text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Création
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">Sans diff</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onInspect(log)}
                    className="h-8 px-2.5 text-xs text-slate-700"
                  >
                    <Eye className="w-3.5 h-3.5 mr-1 text-slate-500" />
                    Examiner
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
