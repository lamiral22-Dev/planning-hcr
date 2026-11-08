import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BoursesView } from "../bourses/bourses-view";
import * as swapActions from "@/actions/swap-actions";

vi.mock("@/actions/swap-actions", () => ({
  requestShiftSwap: vi.fn(),
  respondToSwapRequest: vi.fn(),
}));

describe("BoursesView", () => {
  const dummyReceivedSwap = {
    id: "swap-rec-1",
    shiftId: "shift-1",
    requesterId: "sal-1",
    targetUserId: "sal-current",
    status: "EN_ATTENTE_EQUIPIER",
    reason: "Imprévu",
    rejectedReason: null,
    createdAt: new Date(),
    requesterName: "Lucas Martin",
    targetUserName: "Moi",
    shiftDateStr: "Dimanche 16 Mars",
    shiftTimeStr: "18:00 - 00:00",
  };

  it("affiche la proposition reçue avec les boutons Accepter et Refuser", () => {
    render(
      <BoursesView
        currentUserId="sal-current"
        sentSwaps={[]}
        receivedSwaps={[dummyReceivedSwap]}
        myEligibleShifts={[]}
        colleagues={[]}
      />
    );

    expect(screen.getByText("Lucas Martin")).toBeDefined();
    expect(screen.getByText(/18:00 - 00:00/)).toBeDefined();
    expect(screen.getByText(/Accepter le créneau/i)).toBeDefined();
    expect(screen.getByText(/Refuser/i)).toBeDefined();
  });

  it("affiche le message d'erreur HCR en cas de violation légale lors de l'acceptation", async () => {
    vi.mocked(swapActions.respondToSwapRequest).mockResolvedValue({
      success: false,
      error: "Non-respect du repos quotidien légal (11h consécutives obligatoires).",
      code: "HCR_COMPLIANCE_VIOLATION",
    });

    render(
      <BoursesView
        currentUserId="sal-current"
        sentSwaps={[]}
        receivedSwaps={[dummyReceivedSwap]}
        myEligibleShifts={[]}
        colleagues={[]}
      />
    );

    const acceptButton = screen.getByText(/Accepter le créneau/i);
    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(screen.getByText(/Non-conformité HCR/i)).toBeDefined();
      expect(
        screen.getByText(/Non-respect du repos quotidien légal/i)
      ).toBeDefined();
    });
  });

  it("ouvre le modal de refus et exige un motif avant confirmation", async () => {
    render(
      <BoursesView
        currentUserId="sal-current"
        sentSwaps={[]}
        receivedSwaps={[dummyReceivedSwap]}
        myEligibleShifts={[]}
        colleagues={[]}
      />
    );

    const rejectButton = screen.getByText(/Refuser/i);
    fireEvent.click(rejectButton);

    expect(screen.getByText(/Refuser la proposition d'échange/i)).toBeDefined();

    const confirmRejectButton = screen.getByRole("button", {
      name: /Confirmer le refus/i,
    });
    fireEvent.click(confirmRejectButton);

    expect(screen.getByText(/Le motif de refus est obligatoire/i)).toBeDefined();
  });
});
