import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { LoginForm } from "../login-form";
import * as authActions from "@/actions/auth-actions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock des Server Actions
vi.mock("@/actions/auth-actions", () => ({
  quickLoginByEmail: vi.fn(),
  loginWithCredentials: vi.fn(),
}));

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche les boutons de connexion 1-clic et le lien de seed en mode démo", () => {
    render(<LoginForm isDemoMode={true} />);

    // Bandeau d'environnement de test
    expect(
      screen.getByText(/Environnement de test actif — Comptes pré-configurés disponibles/i)
    ).toBeDefined();

    // Boutons de connexion rapide
    expect(screen.getByText(/Se connecter en tant que Thomas/i)).toBeDefined();
    expect(screen.getByText(/Se connecter en tant que Sarah/i)).toBeDefined();
    expect(screen.getByText(/Se connecter en tant que Manager/i)).toBeDefined();

    // Lien de réinitialisation
    expect(screen.getByText(/Réinitialiser les données de test/i)).toBeDefined();

    // Formulaire standard également présent
    expect(screen.getByLabelText(/Adresse email/i)).toBeDefined();
    expect(screen.getByLabelText(/Mot de passe/i)).toBeDefined();
  });

  it("masque STRICTEMENT les boutons 1-clic et le lien de seed en mode production", () => {
    render(<LoginForm isDemoMode={false} />);

    // Absence du bandeau de test
    expect(
      screen.queryByText(/Environnement de test actif/i)
    ).toBeNull();

    // Absence des boutons de connexion rapide
    expect(screen.queryByText(/Se connecter en tant que Thomas/i)).toBeNull();
    expect(screen.queryByText(/Se connecter en tant que Sarah/i)).toBeNull();
    expect(screen.queryByText(/Se connecter en tant que Manager/i)).toBeNull();

    // Absence du bouton de réinitialisation
    expect(screen.queryByText(/Réinitialiser les données de test/i)).toBeNull();

    // Formulaire d'authentification standard présent et actif
    expect(screen.getByLabelText(/Adresse email/i)).toBeDefined();
    expect(screen.getByLabelText(/Mot de passe/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /^Se connecter$/i })).toBeDefined();
  });

  it("affiche l'erreur retournée par loginWithCredentials dans le bandeau d'alerte rouge sans exception", async () => {
    vi.mocked(authActions.loginWithCredentials).mockResolvedValueOnce({
      success: false,
      error: "Identifiants incorrects ou compte inactif.",
    });

    render(<LoginForm isDemoMode={false} />);

    const emailInput = screen.getByLabelText(/Adresse email/i);
    const passwordInput = screen.getByLabelText(/Mot de passe/i);
    const submitBtn = screen.getByRole("button", { name: /^Se connecter$/i });

    fireEvent.change(emailInput, { target: { value: "test@resto.fr" } });
    fireEvent.change(passwordInput, { target: { value: "wrongpass" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText("Identifiants incorrects ou compte inactif.")
      ).toBeDefined();
    });
  });
});
