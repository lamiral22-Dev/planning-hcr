import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExportsView } from "../exports/exports-view";

describe("ExportsView", () => {
  it("affiche les totaux synthétiques d'heures et d'absences", () => {
    render(
      <ExportsView
        initialSummary={{
          totalHours: 1248.5,
          totalAbsences: 3,
          totalEmployees: 12,
        }}
      />
    );

    expect(screen.getByText("1248.50 h")).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
    expect(screen.getByText("12")).toBeDefined();
    expect(screen.getByText(/Export Paie Conforme HCR/i)).toBeDefined();
  });

  it("met à jour l'URL de téléchargement direct lors du changement de mois", () => {
    render(
      <ExportsView
        initialSummary={{
          totalHours: 100,
          totalAbsences: 0,
          totalEmployees: 2,
        }}
      />
    );

    const prevMonthBtn = screen.getByRole("button", { name: /Mois précédent/i });
    fireEvent.click(prevMonthBtn);

    const downloadLink = screen.getByRole("link", { name: /Télécharger le CSV Paie Conforme/i });
    expect(downloadLink.getAttribute("href")).toContain("/api/manager/export-paie?month=");
  });
});
