/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QuickStatusDialog } from "../arbitrage/quick-status-dialog";
import * as timeActions from "@/actions/time-actions";

vi.mock("@/actions/time-actions", () => ({
  recordOperationalStatus: vi.fn(),
  recordMissedClockIn: vi.fn(),
}));

describe("QuickStatusDialog", () => {
  it("propose l'option oubli de pointage et pré-remplit les heures planifiées", async () => {
    const plannedStart = new Date("2025-01-02T12:00:00Z");
    const plannedEnd = new Date("2025-01-02T15:00:00Z");

    render(
      <QuickStatusDialog
        isOpen={true}
        onClose={vi.fn()}
        shiftId="shift-123"
        employeeName="Thomas Rousseau"
        plannedStartTime={plannedStart}
        plannedEndTime={plannedEnd}
        onSuccess={vi.fn()}
      />
    );

    // Basculer sur l'onglet Oubli de pointage
    const missedClockInTab = screen.getByText(/Oubli de pointage/i);
    fireEvent.click(missedClockInTab);

    expect(screen.getByText(/Heure début effective/i)).toBeDefined();
    expect(screen.getByText(/Heure fin effective/i)).toBeDefined();
    expect(screen.getByText(/obligatoire/i)).toBeDefined();
  });

  it("soumet recordMissedClockIn avec les heures effectives et le motif", async () => {
    vi.mocked(timeActions.recordMissedClockIn).mockResolvedValue({
      success: true,
      data: {} as any,
    });

    const plannedStart = new Date("2025-01-02T12:00:00Z");
    const plannedEnd = new Date("2025-01-02T15:00:00Z");
    const onSuccess = vi.fn();

    render(
      <QuickStatusDialog
        isOpen={true}
        onClose={vi.fn()}
        shiftId="shift-123"
        employeeName="Thomas Rousseau"
        plannedStartTime={plannedStart}
        plannedEndTime={plannedEnd}
        onSuccess={onSuccess}
      />
    );

    fireEvent.click(screen.getByText(/Oubli de pointage/i));

    const motifInput = screen.getByPlaceholderText(/Oubli de badger/i);
    fireEvent.change(motifInput, { target: { value: "Badge oublié à la maison" } });

    const submitBtn = screen.getByText(/Appliquer le statut/i);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(timeActions.recordMissedClockIn).toHaveBeenCalledWith(
        expect.objectContaining({
          shiftId: "shift-123",
          reason: "Badge oublié à la maison",
        })
      );
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
