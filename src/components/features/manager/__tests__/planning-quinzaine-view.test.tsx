/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PlanningQuinzaineView } from "../planning/planning-quinzaine-view";
import * as shiftActions from "@/actions/shift-actions";

vi.mock("@/actions/shift-actions", () => ({
  createShift: vi.fn(),
  updateShift: vi.fn(),
  deleteShift: vi.fn(),
  applyMasterTemplate: vi.fn(),
  publishQuinzaine: vi.fn(),
}));

describe("PlanningQuinzaineView", () => {
  const mockEmployees = [
    { id: "emp-1", name: "Jean Dupont", role: "Cuisinier" },
    { id: "emp-2", name: "Sophie Martin", role: "Serveuse" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche un état vide clair si aucun salarié n'est présent", () => {
    render(<PlanningQuinzaineView employees={[]} initialShifts={[]} />);
    expect(screen.getByText(/Aucun salarié enregistré dans l'établissement/i)).toBeDefined();
  });

  it("affiche les collaborateurs et les shifts avec leurs badges", () => {
    const shifts = [
      {
        id: "shift-1",
        userId: "emp-1",
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        status: "BROUILLON" as const,
        isLateModification: false,
      },
    ];

    render(
      <PlanningQuinzaineView
        employees={mockEmployees}
        initialShifts={shifts}
      />
    );

    expect(screen.getByText("Jean Dupont")).toBeDefined();
    expect(screen.getByText("Sophie Martin")).toBeDefined();
    expect(screen.getByText(/Brouillon/i)).toBeDefined();
  });

  it("déclenche la publication de la quinzaine avec confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.mocked(shiftActions.publishQuinzaine).mockResolvedValue({
      success: true,
      data: { publishedCount: 1, derogationCount: 0 } as any,
    });

    render(
      <PlanningQuinzaineView
        employees={mockEmployees}
        initialShifts={[]}
      />
    );

    const publishBtn = screen.getByRole("button", { name: /Publier la quinzaine/i });
    fireEvent.click(publishBtn);

    await waitFor(() => {
      expect(shiftActions.publishQuinzaine).toHaveBeenCalled();
    });
  });

  it("permet d'ouvrir le modal de création d'un shift", () => {
    render(
      <PlanningQuinzaineView
        employees={mockEmployees}
        initialShifts={[]}
      />
    );

    const createBtn = screen.getByRole("button", { name: /\+ Créer un shift/i });
    fireEvent.click(createBtn);

    expect(screen.getByRole("heading", { name: /Créer un shift/i })).toBeDefined();
    expect(screen.getAllByText(/Collaborateur/i).length).toBeGreaterThan(0);
  });

  it("réutilise un créneau sélectionné au clic et en glisser-déposer", async () => {
    const template = {
      id: "tpl-1", name: "Service soir", weekNumber: 1, dayOfWeek: 1,
      startTime: "20:00", endTime: "02:00", roleTarget: "SALARIE" as const, isActive: true,
    };
    vi.mocked(shiftActions.createShift).mockImplementation(async (input) => ({
      success: true, data: {
        ...input, id: `shift-${input.userId}`, createdAt: new Date(), updatedAt: new Date(),
        acknowledgedAt: null, derogationRequestedAt: null, derogationAcceptedAt: null, derogationComment: null,
      },
    }));
    const { container } = render(
      <PlanningQuinzaineView employees={mockEmployees} initialShifts={[]} initialTemplates={[template]} />
    );
    const bank = screen.getByRole("button", { name: /Service soir 20:00/ });
    expect(bank.textContent).toContain("+1j");
    fireEvent.click(bank);
    fireEvent.click(screen.getAllByTitle("Affecter le créneau sélectionné")[0]);
    await waitFor(() => expect(shiftActions.createShift).toHaveBeenCalledTimes(1));
    const cells = container.querySelectorAll("tbody tr")[1].querySelectorAll("td");
    fireEvent.drop(cells[2], { dataTransfer: { getData: () => "tpl-1" } });
    await waitFor(() => expect(shiftActions.createShift).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("button", { name: /Service soir 20:00/ })).toBeDefined();
  });
});
