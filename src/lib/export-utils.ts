/**
 * Utilitaires pour exports PDF et CSV (Matrice Paie HCR)
 */

import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { APP_TIMEZONE } from "./time-utils";
import type { TimeEntry, User, Shift, QualificationStatus } from "@prisma/client";

export function formatCsvRow(fields: (string | number)[]): string {
  return fields.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(";");
}

export type TimeEntryWithRelations = TimeEntry & {
  user: Pick<User, "id" | "matricule" | "firstName" | "lastName">;
  shift?: Pick<Shift, "id" | "startTime" | "endTime"> | null;
};

export interface PayrollRowData {
  ID_Salarie: string;
  Nom_Prenom: string;
  Date_Shift: string;
  Heure_Debut: string;
  Heure_Fin: string;
  Total_Heures: string;
  Statut_Qualification: string;
}

/**
 * Traduction française exacte des statuts de qualification selon le CdC
 */
export const QUALIFICATION_LABELS: Record<QualificationStatus, string> = {
  CONFORME: "Conforme",
  HEURES_MODIFIEES: "Heures modifiées",
  RETARD: "Retard",
  ABSENT_INJUSTIFIE: "Absent injustifié",
  MALADIE: "Maladie",
  VACANCES: "Vacances",
};

/**
 * Construit une ligne de paie consolidée pour un TimeEntry selon les 7 colonnes strictes du CdC :
 * 1. ID_Salarie : Matricule unique
 * 2. Nom_Prenom : Nom Prénom complet
 * 3. Date_Shift : Format JJ/MM/AAAA (dans Europe/Paris)
 * 4. Heure_Debut : Format HH:MM (priorité arbitrage managérial > pointage brut)
 * 5. Heure_Fin : Format HH:MM (priorité arbitrage managérial > pointage arrondi)
 * 6. Total_Heures : Format décimal sur 2 chiffres (neutralisé à 0.00 en cas d'absence injustifiée, maladie ou congés)
 * 7. Statut_Qualification : Libellé exact
 */
export function buildPayrollRow(
  entry: TimeEntryWithRelations,
  timeZone: string = APP_TIMEZONE
): PayrollRowData {
  const matricule = entry.user.matricule;
  const fullName = `${entry.user.lastName} ${entry.user.firstName}`.trim();

  // Déterminer la date de référence du shift
  const effectiveDate = entry.shift?.startTime ?? entry.clockInTime;
  const zonedDate = toZonedTime(effectiveDate, timeZone);
  const dateShiftStr = format(zonedDate, "dd/MM/yyyy");

  // Déterminer l'heure de début retenue
  const effectiveStartTime = entry.correctedClockInTime ?? entry.clockInTime;
  const zonedStartTime = toZonedTime(effectiveStartTime, timeZone);
  const heureDebutStr = format(zonedStartTime, "HH:mm");

  // Déterminer l'heure de fin retenue
  const effectiveEndTime =
    entry.correctedClockOutTime ??
    entry.roundedClockOutTime ??
    entry.rawClockOutTime ??
    entry.clockInTime;
  const zonedEndTime = toZonedTime(effectiveEndTime, timeZone);
  const heureFinStr = format(zonedEndTime, "HH:mm");

  // Calcul du total des heures
  let totalHoursStr = "0.00";

  // Neutralisation stricte des heures pour imprévus sans travail
  const isNeutralized =
    entry.qualification === "ABSENT_INJUSTIFIE" ||
    entry.qualification === "MALADIE" ||
    entry.qualification === "VACANCES";

  if (!isNeutralized) {
    const diffMs = effectiveEndTime.getTime() - effectiveStartTime.getTime();
    if (diffMs > 0) {
      const hoursDecimal = diffMs / (1000 * 60 * 60);
      totalHoursStr = hoursDecimal.toFixed(2);
    }
  }

  const qualificationLabel =
    QUALIFICATION_LABELS[entry.qualification] ?? entry.qualification;

  return {
    ID_Salarie: matricule,
    Nom_Prenom: fullName,
    Date_Shift: dateShiftStr,
    Heure_Debut: heureDebutStr,
    Heure_Fin: heureFinStr,
    Total_Heures: totalHoursStr,
    Statut_Qualification: qualificationLabel,
  };
}

/**
 * Génère le fichier CSV complet avec encodage BOM UTF-8 (\uFEFF) et séparateur point-virgule (;)
 */
export function generatePayrollCsv(
  entries: TimeEntryWithRelations[],
  timeZone: string = APP_TIMEZONE
): string {
  const headers = [
    "ID_Salarie",
    "Nom_Prenom",
    "Date_Shift",
    "Heure_Debut",
    "Heure_Fin",
    "Total_Heures",
    "Statut_Qualification",
  ];

  const lines = [formatCsvRow(headers)];

  for (const entry of entries) {
    const row = buildPayrollRow(entry, timeZone);
    lines.push(
      formatCsvRow([
        row.ID_Salarie,
        row.Nom_Prenom,
        row.Date_Shift,
        row.Heure_Debut,
        row.Heure_Fin,
        row.Total_Heures,
        row.Statut_Qualification,
      ])
    );
  }

  // BOM UTF-8 (\uFEFF) pour compatibilité Excel
  return "\uFEFF" + lines.join("\r\n");
}
