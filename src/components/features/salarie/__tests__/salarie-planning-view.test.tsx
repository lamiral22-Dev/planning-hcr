/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SalariePlanningView } from "../planning/salarie-planning-view";
import * as shiftActions from "@/actions/shift-actions";

vi.mock("@/actions/shift-actions", () => ({
  acknowledgeShift: vi.fn(),
  acceptDerogation: vi.fn(),
}));

describe("SalariePlanningView", () => {
  it("affiche l'empty state explicite lorsqu'aucun créneau n'est planifié", () => {
    render(<SalariePlanningView shifts={[]} />);

    expect(screen.getByText(/Aucun shift planifié/i)).toBeDefined();
    expect(screen.getByText(/Profitez de votre repos légal/i)).toBeDefined();
  });

  it("affiche la bannière bloquante de dérogation pour un shift à J < 8 et exige la mention exacte", async () => {
    const lateShift = {
      id: "late-shift-1",
      startTime: new Date("2025-06-01T12:00:00Z"),
      endTime: new Date("2025-06-01T18:00:00Z"),
      status: "EN_ATTENTE_DEROGATION",
      isLateModification: true,
      planningVersion: 1,
    };

    render(<SalariePlanningView shifts={[lateShift]} />);

    // Alerte visible
    expect(screen.getByText(/Accord dérogatoire formel requis/i)).toBeDefined();

    // Ouverture du modal
    const button = screen.getByText(/Examiner la dérogation/i);
    fireEvent.click(button);

    // Formulation exacte du CdC
    const checkboxLabel = screen.getByText(
      "J'accepte expressément la modification de mon planning à titre dérogatoire"
    );
    expect(checkboxLabel).toBeDefined();

    const confirmButton = screen.getByRole("button", { name: /Confirmer l'accord/i }) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(true);

    // Cocher la case active le bouton
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(confirmButton.disabled).toBe(false);

    vi.mocked(shiftActions.acceptDerogation).mockResolvedValue({
      success: true,
      data: {} as any,
    });

    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(shiftActions.acceptDerogation).toHaveBeenCalledWith({
        shiftId: "late-shift-1",
        comment: undefined,
      });
    });
  });

  it("propose l'émargement légal si le planning est publié et non émargé", async () => {
    const shift = {
      id: "shift-norm",
      startTime: new Date("2025-06-10T12:00:00Z"),
      endTime: new Date("2025-06-10T18:00:00Z"),
      status: "PUBLIE",
      isLateModification: false,
      acknowledgedAt: null,
      planningVersion: 2,
    };

    vi.mocked(shiftActions.acknowledgeShift).mockResolvedValue({
      success: true,
      data: {} as any,
    });

    render(<SalariePlanningView shifts={[shift]} />);

    expect(screen.getByText(/Émargement obligatoire/i)).toBeDefined();
    expect(screen.getByText(/Version 2/i)).toBeDefined();

    const ackButton = screen.getByText(/J'ai pris connaissance de mon planning/i);
    fireEvent.click(ackButton);

    await waitFor(() => {
      expect(shiftActions.acknowledgeShift).toHaveBeenCalledWith({
        shiftId: "shift-norm",
      });
    });
  });
});
