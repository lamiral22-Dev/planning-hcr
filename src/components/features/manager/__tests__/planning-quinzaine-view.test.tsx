/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PlanningQuinzaineView } from "../planning/planning-quinzaine-view";
import * as shiftActions from "@/actions/shift-actions";

vi.mock("@/actions/shift-actions", () => ({
  createShift: vi.fn(),
  updateShift: vi.fn(),
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
});
