import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PlanningToolbar } from "../planning/planning-toolbar";
import { publishQuinzaine } from "@/actions/shift-actions";

vi.mock("@/actions/shift-actions", () => ({
  applyMasterTemplate: vi.fn(),
  publishQuinzaine: vi.fn(),
}));

vi.mock("@/actions/template-actions", () => ({
  getMasterTemplates: vi.fn().mockResolvedValue({ success: true, data: [] }),
  upsertMasterTemplate: vi.fn(),
  deleteMasterTemplate: vi.fn(),
}));

describe("PlanningToolbar", () => {
  it("affiche le bouton 'Gérer le planning type' et ouvre la modal au clic", async () => {
    render(
      <PlanningToolbar
        startDate={new Date("2025-01-01")}
        endDate={new Date("2025-01-14")}
      />
    );

    const configButton = screen.getByText(/Gérer le planning type/i);
    expect(configButton).toBeDefined();

    fireEvent.click(configButton);

    expect(screen.getByText(/Configuration de la Grille Type/i)).toBeDefined();
  });

  it("inclut le dernier dimanche entier en heure de Paris, y compris au changement d'heure", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.mocked(publishQuinzaine).mockResolvedValue({ success: true, data: {} });
    render(<PlanningToolbar startDate={new Date(2026, 2, 16)} endDate={new Date(2026, 2, 29)} />);
    fireEvent.click(screen.getByRole("button", { name: /Publier la quinzaine/ }));
    await waitFor(() => expect(publishQuinzaine).toHaveBeenCalledWith(
      new Date("2026-03-15T23:00:00.000Z"),
      new Date("2026-03-29T21:59:59.999Z")
    ));
  });
});
