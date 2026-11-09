/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ArbitrageView } from "../arbitrage/arbitrage-view";
import * as timeActions from "@/actions/time-actions";
import * as swapActions from "@/actions/swap-actions";

vi.mock("@/actions/time-actions", () => ({
  arbitrateTimeEntry: vi.fn(),
  recordOperationalStatus: vi.fn(),
}));

vi.mock("@/actions/swap-actions", () => ({
  arbitrateShiftSwap: vi.fn(),
}));

describe("ArbitrageView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockDiscrepancies = [
    {
      id: "entry-1",
      timeEntryId: "entry-1",
      shiftId: "shift-1",
      employeeName: "Thomas Blanc",
      date: "2025-06-02T09:00:00Z",
      plannedStart: "2025-06-02T09:00:00Z",
      plannedEnd: "2025-06-02T15:00:00Z",
      rawClockIn: "2025-06-02T09:02:00Z",
      rawClockOut: "2025-06-02T16:18:00Z",
      roundedClockOut: "2025-06-02T16:15:00Z",
      employeeReason: "Fin de service tardive",
      currentQualification: "CONFORME" as any,
    },
  ];

  const mockSwaps = [
    {
      id: "swap-1",
      shiftId: "shift-2",
      shiftDate: "2025-06-05T12:00:00Z",
      shiftTime: "12:00 - 20:00",
      requesterName: "Jean Dupont",
      targetUserName: "Sophie Martin",
      reason: "Rendez-vous médical",
    },
  ];

  it("affiche la table contradictoire des pointages en écart", () => {
    render(
      <ArbitrageView
        discrepancies={mockDiscrepancies}
        swaps={mockSwaps}
      />
    );

    expect(screen.getByText("Thomas Blanc")).toBeDefined();
    expect(screen.getByText(/Fin de service tardive/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /Rectifier/i })).toBeDefined();
  });

  it("exige un motif obligatoire pour valider la rectification managériale", async () => {
    render(
      <ArbitrageView
        discrepancies={mockDiscrepancies}
        swaps={mockSwaps}
      />
    );

    // Clic Rectifier
    const rectifyBtn = screen.getByRole("button", { name: /Rectifier/i });
    fireEvent.click(rectifyBtn);

    // Clic Enregistrer sans motif
    const saveBtn = screen.getByRole("button", { name: /Enregistrer/i });
    fireEvent.click(saveBtn);

    expect(screen.getByText(/Le motif de rectification managériale est obligatoire/i)).toBeDefined();
    expect(timeActions.arbitrateTimeEntry).not.toHaveBeenCalled();

    // Saisie du motif
    const motifInput = screen.getByPlaceholderText(/Motif obligatoire/i);
    fireEvent.change(motifInput, { target: { value: "Heures supplémentaires validées" } });

    vi.mocked(timeActions.arbitrateTimeEntry).mockResolvedValue({
      success: true,
      data: {} as any,
    });

    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(timeActions.arbitrateTimeEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          timeEntryId: "entry-1",
          qualification: "HEURES_MODIFIEES",
          arbitrationReason: "Heures supplémentaires validées",
        })
      );
    });
  });

  it("permet de basculer sur l'onglet bourse d'échanges et de valider un swap", async () => {
    render(
      <ArbitrageView
        discrepancies={mockDiscrepancies}
        swaps={mockSwaps}
      />
    );

    const swapTab = screen.getByRole("button", { name: /Bourse d'échanges en attente/i });
    fireEvent.click(swapTab);

    expect(screen.getByText("Jean Dupont")).toBeDefined();
    expect(screen.getByText("Sophie Martin")).toBeDefined();
    expect(screen.getByText(/Rendez-vous médical/i)).toBeDefined();

    vi.mocked(swapActions.arbitrateShiftSwap).mockResolvedValue({
      success: true,
      data: {} as any,
    });

    const approveBtn = screen.getByRole("button", { name: /Valider l'échange/i });
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(swapActions.arbitrateShiftSwap).toHaveBeenCalledWith({
        swapId: "swap-1",
        approved: true,
      });
    });
  });
});
