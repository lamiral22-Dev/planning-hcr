/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { SalariePlanningView } from "../planning/salarie-planning-view";
import * as shiftActions from "@/actions/shift-actions";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

vi.mock("@/actions/shift-actions", () => ({
  acknowledgeShift: vi.fn(),
  acceptDerogation: vi.fn(),
}));

describe("SalariePlanningView", () => {
  afterEach(() => vi.useRealTimers());

  it("affiche l'empty state explicite lorsqu'aucun créneau n'est planifié", () => {
    render(<SalariePlanningView shifts={[]} />);

    expect(screen.getAllByText(/Aucun créneau/i)).toHaveLength(15);
  });

  it("affiche 15 jours parisiens consécutifs et navigue par périodes sans chevauchement", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T23:30:00Z"));
    render(<SalariePlanningView shifts={[]} />);

    expect(screen.getByText("Du 29 mars 2026 au 12 avril 2026")).toBeDefined();
    expect(screen.getAllByRole("listitem")).toHaveLength(15);
    expect(within(screen.getAllByRole("listitem")[0]).getByText("Aujourd'hui")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /15 jours suiv/ }));
    expect(screen.getByText("Du 13 avril 2026 au 27 avril 2026")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /15 jours préc/ }));
    fireEvent.click(screen.getByRole("button", { name: /15 jours préc/ }));
    expect(screen.getByText("Du 14 mars 2026 au 28 mars 2026")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Aujourd'hui" }));
    expect(screen.getByText("Du 29 mars 2026 au 12 avril 2026")).toBeDefined();
  });

  it("regroupe les créneaux et absences par jour et ouvre la dérogation du bon créneau", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-24T10:00:00Z"));
    render(<SalariePlanningView shifts={[
      { id: "midi", startTime: new Date("2026-11-24T10:00:00Z"), endTime: new Date("2026-11-24T14:00:00Z"), status: "PUBLIE", acknowledgedAt: new Date() },
      { id: "soir", startTime: new Date("2026-11-24T17:00:00Z"), endTime: new Date("2026-11-24T21:00:00Z"), status: "EN_ATTENTE_DEROGATION", planningVersion: 3 },
      { id: "fin", startTime: new Date("2026-12-08T10:00:00Z"), endTime: new Date("2026-12-08T14:00:00Z"), status: "PUBLIE", acknowledgedAt: new Date() },
      { id: "hors-periode", startTime: new Date("2026-12-09T10:00:00Z"), endTime: new Date("2026-12-09T14:00:00Z"), status: "PUBLIE", acknowledgedAt: new Date() },
    ]} leaves={[
      { id: "cp", type: "CP", status: "APPROUVE", startDate: "2026-11-24", endDate: "2026-11-25" },
      { id: "repos", type: "REPOS", status: "EN_ATTENTE", startDate: "2026-11-25", endDate: "2026-11-25" },
    ]} />);

    const days = screen.getAllByRole("listitem");
    expect(within(days[0]).getByText("11:00 - 15:00")).toBeDefined();
    expect(within(days[0]).getByText("18:00 - 22:00")).toBeDefined();
    expect(within(days[0]).getAllByText("Durée : 4.0h")).toHaveLength(2);
    expect(within(days[0]).getByText("CP · Validé")).toBeDefined();
    expect(within(days[0]).getByText("Accord dérogatoire requis")).toBeDefined();
    expect(within(days[0]).getByRole("button", { name: /Échanger/ })).toBeDefined();
    expect(within(days[1]).getByText("CP · Validé")).toBeDefined();
    expect(within(days[1]).getByText("Repos · En attente")).toBeDefined();
    expect(within(days[14]).getByText("11:00 - 15:00")).toBeDefined();
    expect(screen.getAllByText("11:00 - 15:00")).toHaveLength(2);
    fireEvent.click(within(days[0]).getByRole("button", { name: /Donner mon accord/ }));
    expect(screen.getByText(/J'accepte expressément la modification/)).toBeDefined();
  });

  it("affiche le solde CP et bloque la demande lorsque la période dépasse le solde", () => {
    render(<SalariePlanningView shifts={[]} cpBalance={{ hireDate: "2026-11-02T10:00:00Z", adjustment: 1 }} />);
    fireEvent.click(screen.getByRole("button", { name: /Demander un CP/ }));
    fireEvent.change(screen.getByLabelText("Début"), { target: { value: "2026-11-24" } });
    fireEvent.change(screen.getByLabelText("Fin"), { target: { value: "2026-11-25" } });

    expect(screen.getByText(/CP restants à la date choisie : 1,0 jour/)).toBeDefined();
    expect(screen.getByText(/Période sélectionnée : 2 jour\(s\) décompté\(s\)/)).toBeDefined();
    expect(screen.getByText("Solde de CP insuffisant : la prise de CP anticipés n'est pas autorisée.")).toBeDefined();
    expect((screen.getByRole("button", { name: "Envoyer la demande" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("actualise le solde selon la date choisie et affiche les jours fériés", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-24T10:00:00Z"));
    render(<SalariePlanningView shifts={[]} cpBalance={{ hireDate: "2026-11-02T10:00:00Z", adjustment: 0 }} />);
    fireEvent.click(screen.getByRole("button", { name: /Demander un CP/ }));
    fireEvent.change(screen.getByLabelText("Début"), { target: { value: "2026-11-30" } });
    expect(screen.getByText(/CP restants à la date choisie : 0,0 jours/)).toBeDefined();
    fireEvent.change(screen.getByLabelText("Début"), { target: { value: "2026-12-01" } });
    fireEvent.change(screen.getByLabelText("Fin"), { target: { value: "2026-12-02" } });
    expect(screen.getByText(/CP restants à la date choisie : 2,5 jours/)).toBeDefined();
    expect((screen.getByRole("button", { name: "Envoyer la demande" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.change(screen.getByLabelText("Fin"), { target: { value: "2026-12-03" } });
    expect((screen.getByRole("button", { name: "Envoyer la demande" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /15 jours suiv/ }));
    fireEvent.click(screen.getByRole("button", { name: /15 jours suiv/ }));
    expect(screen.getByText("Férié · Noël")).toBeDefined();
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
        planningVersion: 1,
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
