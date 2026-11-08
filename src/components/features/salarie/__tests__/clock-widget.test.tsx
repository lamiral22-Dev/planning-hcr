/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ClockWidget } from "../time-tracking/clock-widget";
import * as timeActions from "@/actions/time-actions";

vi.mock("@/actions/time-actions", () => ({
  clockIn: vi.fn(),
  clockOut: vi.fn(),
}));

describe("ClockWidget", () => {
  it("affiche le bouton de prise de poste quand aucun pointage actif n'existe", () => {
    render(<ClockWidget activeTimeEntryId={null} activeClockInTime={null} />);

    expect(screen.getByText(/PRISE DE POSTE/i)).toBeDefined();
    expect(screen.getByText(/Prêt à pointer/i)).toBeDefined();
  });

  it("appelle clockIn sans injecter de userId client lors du clic sur Prise de poste", async () => {
    vi.mocked(timeActions.clockIn).mockResolvedValue({
      success: true,
      data: {} as any,
    });

    const shift = {
      id: "shift-123",
      startTime: new Date("2025-01-01T12:00:00Z"),
      endTime: new Date("2025-01-01T15:00:00Z"),
    };

    render(
      <ClockWidget
        activeTimeEntryId={null}
        activeClockInTime={null}
        currentShift={shift}
      />
    );

    const button = screen.getByText(/PRISE DE POSTE/i);
    fireEvent.click(button);

    await waitFor(() => {
      // Vérification sécurité : aucun userId passé côté client
      expect(timeActions.clockIn).toHaveBeenCalledWith({
        shiftId: "shift-123",
      });
    });
  });

  it("affiche le bouton de fin de service quand un pointage est en cours", () => {
    render(
      <ClockWidget
        activeTimeEntryId="te-1"
        activeClockInTime={new Date("2025-01-01T10:00:00Z")}
      />
    );

    expect(screen.getByText(/FIN DE SERVICE/i)).toBeDefined();
    expect(screen.getByText(/Service en cours/i)).toBeDefined();
  });
});
