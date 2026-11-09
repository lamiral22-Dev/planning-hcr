"use client";

import React from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AuditLogItem } from "@/actions/audit-actions";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { APP_TIMEZONE } from "@/lib/time-utils";
import { Clock, ShieldCheck, User } from "lucide-react";

interface AuditDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  log: AuditLogItem | null;
}

export function AuditDrawer({ isOpen, onClose, log }: AuditDrawerProps) {
  if (!log) return null;

  const zonedDate = toZonedTime(log.timestamp, APP_TIMEZONE);
  const formattedDate = format(zonedDate, "dd/MM/yyyy 'à' HH:mm:ss");

  const oldObj = (log.payloadOld && typeof log.payloadOld === "object" ? log.payloadOld : {}) as Record<string, unknown>;
  const newObj = (log.payloadNew && typeof log.payloadNew === "object" ? log.payloadNew : {}) as Record<string, unknown>;

  // Extraire l'ensemble des clés
  const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));

  const formatValue = (val: unknown) => {
    if (val === undefined || val === null) return <span className="text-slate-400 italic">null</span>;
    if (typeof val === "boolean") return val ? "true" : "false";
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Trace d'Audit Inviolable"
      description={`Identifiant légal unique : ${log.id}`}
    >
      <div className="space-y-5 pt-2">
        {/* Métadonnées certifiées */}
        <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
          <div>
            <div className="text-slate-500 flex items-center gap-1 font-medium mb-0.5">
              <Clock className="w-3.5 h-3.5" />
              Horodatage certifié (Europe/Paris)
            </div>
            <div className="font-semibold text-slate-800">{formattedDate}</div>
          </div>

          <div>
            <div className="text-slate-500 flex items-center gap-1 font-medium mb-0.5">
              <User className="w-3.5 h-3.5" />
              Auteur de l&apos;action
            </div>
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <span>{log.userName || "Système"}</span>
              {log.userRole && (
                <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                  {log.userRole}
                </Badge>
              )}
            </div>
          </div>

          <div>
            <div className="text-slate-500 font-medium mb-0.5">Type d&apos;action</div>
            <div className="font-mono font-semibold text-blue-700">{log.action}</div>
          </div>

          <div>
            <div className="text-slate-500 font-medium mb-0.5">Table & Enregistrement ciblé</div>
            <div className="font-mono text-slate-800 truncate" title={`${log.tableName} (#${log.recordId})`}>
              {log.tableName} (#{log.recordId})
            </div>
          </div>
        </div>

        {/* Diff visuel des données */}
        <div>
          <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-slate-700">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Comparatif Avant / Après (Champs modifiés mis en exergue)</span>
          </div>

          {allKeys.length === 0 ? (
            <div className="p-4 bg-slate-50 text-slate-500 text-center text-xs rounded border border-slate-200">
              Aucun payload structuré enregistré pour cet événement.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
              <div className="grid grid-cols-12 bg-slate-100 font-semibold text-slate-700 py-2 px-3 border-b border-slate-200">
                <div className="col-span-4">Champ</div>
                <div className="col-span-4">État Initial (payloadOld)</div>
                <div className="col-span-4">Nouvel État (payloadNew)</div>
              </div>

              <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                {allKeys.map((key) => {
                  const oldVal = oldObj[key];
                  const newVal = newObj[key];
                  const hasChanged = JSON.stringify(oldVal) !== JSON.stringify(newVal);

                  return (
                    <div
                      key={key}
                      className={`grid grid-cols-12 py-2 px-3 items-center ${
                        hasChanged ? "bg-amber-50/70" : "bg-white"
                      }`}
                    >
                      <div className="col-span-4 font-mono font-medium text-slate-800 truncate" title={key}>
                        {key}
                        {hasChanged && (
                          <span className="ml-1.5 inline-block text-[9px] uppercase px-1 py-0.2 bg-amber-200 text-amber-800 rounded font-sans font-bold">
                            Modifié
                          </span>
                        )}
                      </div>
                      <div className="col-span-4 text-slate-600 truncate pr-2 font-mono" title={String(oldVal)}>
                        {formatValue(oldVal)}
                      </div>
                      <div
                        className={`col-span-4 font-mono truncate ${
                          hasChanged ? "font-semibold text-blue-700" : "text-slate-600"
                        }`}
                        title={String(newVal)}
                      >
                        {formatValue(newVal)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* JSON brut inspectable */}
        <details className="text-xs text-slate-600">
          <summary className="cursor-pointer font-medium text-slate-700 hover:text-slate-900 mb-1">
            Visualiser le dump JSON brut
          </summary>
          <pre className="p-3 bg-slate-900 text-slate-100 rounded text-[11px] overflow-x-auto max-h-40 font-mono">
            {JSON.stringify(
              {
                id: log.id,
                action: log.action,
                tableName: log.tableName,
                recordId: log.recordId,
                timestamp: log.timestamp,
                payloadOld: log.payloadOld,
                payloadNew: log.payloadNew,
              },
              null,
              2
            )}
          </pre>
        </details>

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
