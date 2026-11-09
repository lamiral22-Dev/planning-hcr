import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { PlanningToolbar } from "../planning/planning-toolbar";

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
});
