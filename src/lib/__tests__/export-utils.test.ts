import { describe, it, expect } from "vitest";
import {
  buildPayrollRow,
  generatePayrollCsv,
  formatCsvRow,
  type TimeEntryWithRelations,
} from "@/lib/export-utils";

describe("export-utils.ts (Matrice Paie CSV)", () => {
  const dummyUser = {
    id: "usr-1",
    matricule: "HCR-0042",
    firstName: "Jean",
    lastName: "Dupont",
  };

  describe("formatCsvRow", () => {
    it("échappe les guillemets et sépare les colonnes par des points-virgules", () => {
      const row = formatCsvRow(["Nom", 'L\'"Ami"', 42]);
      expect(row).toBe('"Nom";"L\'""Ami""";"42"');
    });
  });

  describe("buildPayrollRow", () => {
    it("construit une ligne conforme standard avec calcul des heures décimales (ex: 8.00)", () => {
      const entry: TimeEntryWithRelations = {
        id: "te-1",
        userId: "usr-1",
        shiftId: "sh-1",
        clockInTime: new Date("2025-01-15T08:00:00+01:00"),
        rawClockOutTime: new Date("2025-01-15T16:00:00+01:00"),
        roundedClockOutTime: new Date("2025-01-15T16:00:00+01:00"),
        correctedClockInTime: null,
        correctedClockOutTime: null,
        qualification: "CONFORME",
        discrepancyReason: null,
        arbitrationReason: null,
        managerId: null,
        arbitratedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: dummyUser,
      };

      const row = buildPayrollRow(entry);

      expect(row.ID_Salarie).toBe("HCR-0042");
      expect(row.Nom_Prenom).toBe("Dupont Jean");
      expect(row.Date_Shift).toBe("15/01/2025");
      expect(row.Heure_Debut).toBe("08:00");
      expect(row.Heure_Fin).toBe("16:00");
      expect(row.Total_Heures).toBe("8.00");
      expect(row.Statut_Qualification).toBe("Conforme");
    });

    it("prend en compte les heures rectifiées par le manager", () => {
      const entry: TimeEntryWithRelations = {
        id: "te-2",
        userId: "usr-1",
        shiftId: "sh-1",
        clockInTime: new Date("2025-01-15T08:00:00+01:00"),
        rawClockOutTime: new Date("2025-01-15T16:00:00+01:00"),
        roundedClockOutTime: new Date("2025-01-15T16:00:00+01:00"),
        correctedClockInTime: new Date("2025-01-15T08:30:00+01:00"),
        correctedClockOutTime: new Date("2025-01-15T16:00:00+01:00"),
        qualification: "HEURES_MODIFIEES",
        discrepancyReason: null,
        arbitrationReason: "Arrivée décalée",
        managerId: "mgr-1",
        arbitratedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        user: dummyUser,
      };

      const row = buildPayrollRow(entry);

      expect(row.Heure_Debut).toBe("08:30");
      expect(row.Heure_Fin).toBe("16:00");
      expect(row.Total_Heures).toBe("7.50");
      expect(row.Statut_Qualification).toBe("Heures modifiées");
    });

    it("neutralise strictement à 0.00 en cas d'absence injustifiée, maladie ou congés", () => {
      const absentEntry: TimeEntryWithRelations = {
        id: "te-abs",
        userId: "usr-1",
        shiftId: "sh-1",
        clockInTime: new Date("2025-01-15T08:00:00+01:00"),
        rawClockOutTime: new Date("2025-01-15T08:00:00+01:00"),
        roundedClockOutTime: new Date("2025-01-15T08:00:00+01:00"),
        correctedClockInTime: null,
        correctedClockOutTime: null,
        qualification: "ABSENT_INJUSTIFIE",
        discrepancyReason: "Pas venu",
        arbitrationReason: null,
        managerId: null,
        arbitratedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: dummyUser,
      };

      const rowAbs = buildPayrollRow(absentEntry);
      expect(rowAbs.Total_Heures).toBe("0.00");
      expect(rowAbs.Statut_Qualification).toBe("Absent injustifié");

      const maladieEntry: TimeEntryWithRelations = {
        ...absentEntry,
        id: "te-mal",
        qualification: "MALADIE",
      };
      const rowMal = buildPayrollRow(maladieEntry);
      expect(rowMal.Total_Heures).toBe("0.00");
      expect(rowMal.Statut_Qualification).toBe("Maladie");

      const vacancesEntry: TimeEntryWithRelations = {
        ...absentEntry,
        id: "te-vac",
        qualification: "VACANCES",
      };
      const rowVac = buildPayrollRow(vacancesEntry);
      expect(rowVac.Total_Heures).toBe("0.00");
      expect(rowVac.Statut_Qualification).toBe("Vacances");
    });
  });

  describe("generatePayrollCsv", () => {
    it("génère le CSV complet avec BOM UTF-8 (\\uFEFF) et les 7 colonnes requises", () => {
      const entry: TimeEntryWithRelations = {
        id: "te-1",
        userId: "usr-1",
        shiftId: "sh-1",
        clockInTime: new Date("2025-01-15T08:00:00+01:00"),
        rawClockOutTime: new Date("2025-01-15T16:00:00+01:00"),
        roundedClockOutTime: new Date("2025-01-15T16:00:00+01:00"),
        correctedClockInTime: null,
        correctedClockOutTime: null,
        qualification: "CONFORME",
        discrepancyReason: null,
        arbitrationReason: null,
        managerId: null,
        arbitratedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: dummyUser,
      };

      const csv = generatePayrollCsv([entry]);

      // Vérification présence BOM UTF-8
      expect(csv.startsWith("\uFEFF")).toBe(true);

      const lines = csv.replace("\uFEFF", "").split("\r\n");
      expect(lines).toHaveLength(2);

      // En-tête strict
      expect(lines[0]).toBe(
        '"ID_Salarie";"Nom_Prenom";"Date_Shift";"Heure_Debut";"Heure_Fin";"Total_Heures";"Statut_Qualification"'
      );

      // Ligne de données
      expect(lines[1]).toBe(
        '"HCR-0042";"Dupont Jean";"15/01/2025";"08:00";"16:00";"8.00";"Conforme"'
      );
    });
  });
});
