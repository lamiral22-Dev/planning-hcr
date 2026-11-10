import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { formatCsvRow } from "@/lib/export-utils";
import { APP_TIMEZONE } from "@/lib/time-utils";
import type { AuditLogItem } from "@/actions/audit-actions";

/**
 * Génère une chaîne CSV du registre d'audit avec encodage UTF-8 BOM (\uFEFF) et séparateur point-virgule (;).
 * Fonction utilitaire synchrone découplée des Server Actions.
 */
export function generateAuditCsv(
  logs: AuditLogItem[],
  timeZone: string = APP_TIMEZONE
): string {
  const headers = [
    "Date_Heure",
    "Action",
    "Table",
    "Record_Id",
    "Auteur_Nom",
    "Auteur_Role",
    "Payload_Old",
    "Payload_New",
  ];

  const lines = [formatCsvRow(headers)];

  for (const log of logs) {
    const zonedDate = toZonedTime(log.timestamp, timeZone);
    const dateStr = format(zonedDate, "dd/MM/yyyy HH:mm:ss");

    const payloadOldStr = log.payloadOld ? JSON.stringify(log.payloadOld) : "";
    const payloadNewStr = log.payloadNew ? JSON.stringify(log.payloadNew) : "";

    lines.push(
      formatCsvRow([
        dateStr,
        log.action,
        log.tableName,
        log.recordId,
        log.userName ?? "Système",
        log.userRole ?? "",
        payloadOldStr,
        payloadNewStr,
      ])
    );
  }

  return "\uFEFF" + lines.join("\r\n");
}
