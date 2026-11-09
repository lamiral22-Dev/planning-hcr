import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { EquipeView } from "../equipe-view";
import type { UserListItem } from "@/actions/user-actions";

vi.mock("@/actions/user-actions", () => ({
  getUsers: vi.fn().mockResolvedValue({ success: true, data: [] }),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  toggleUserActiveStatus: vi.fn(),
}));

describe("EquipeView", () => {
  const mockUsers: UserListItem[] = [
    {
      id: "sal-1",
      matricule: "SAL-001",
      email: "thomas@resto.fr",
      firstName: "Thomas",
      lastName: "Rousseau",
      role: "SALARIE",
      contractWeeklyHours: 35.0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "sal-2",
      matricule: "SAL-002",
      email: "sarah@resto.fr",
      firstName: "Sarah",
      lastName: "Benali",
      role: "SALARIE",
      contractWeeklyHours: 39.0,
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  it("affiche la liste des collaborateurs avec leurs statuts et contrats", () => {
    render(<EquipeView initialUsers={mockUsers} currentUserId="mgr-1" />);

    expect(screen.getByText("Rousseau Thomas")).toBeDefined();
    expect(screen.getByText("SAL-001")).toBeDefined();
    expect(screen.getByText("35h / semaine")).toBeDefined();
    expect(screen.getByText("Actif")).toBeDefined();

    expect(screen.getByText("Benali Sarah")).toBeDefined();
    expect(screen.getByText("SAL-002")).toBeDefined();
    expect(screen.getByText("Archivé")).toBeDefined();
  });

  it("ouvre la modale d'ajout au clic sur 'Ajouter un collaborateur'", () => {
    render(<EquipeView initialUsers={mockUsers} currentUserId="mgr-1" />);

    const addButton = screen.getByText("Ajouter un collaborateur");
    fireEvent.click(addButton);

    expect(screen.getByText("Matricule unique *")).toBeDefined();
    expect(screen.getByText("Adresse email professionnelle *")).toBeDefined();
  });

  it("désactive le bouton de désactivation pour le manager lui-même", () => {
    const usersWithManager: UserListItem[] = [
      {
        id: "mgr-1",
        matricule: "MGR-001",
        email: "alex@resto.fr",
        firstName: "Alex",
        lastName: "Dupuis",
        role: "MANAGER",
        contractWeeklyHours: 39.0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    render(<EquipeView initialUsers={usersWithManager} currentUserId="mgr-1" />);

    const deactButton = screen.getByRole("button", { name: /Désactiver/i });
    expect(deactButton.hasAttribute("disabled")).toBe(true);
  });
});
