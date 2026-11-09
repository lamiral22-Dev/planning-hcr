import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";
import { PwaInstallPrompt } from "../pwa-install-prompt";

describe("PwaInstallPrompt", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("ne s'affiche pas par défaut s'il n'y a pas d'événement beforeinstallprompt ni iOS", () => {
    render(<PwaInstallPrompt />);
    expect(screen.queryByText(/Installer l'application HCR/i)).toBeNull();
  });

  it("s'affiche lorsqu'un événement beforeinstallprompt est émis et permet d'ignorer", async () => {
    render(<PwaInstallPrompt />);

    const fakePrompt = {
      preventDefault: vi.fn(),
      prompt: vi.fn(),
      userChoice: Promise.resolve({ outcome: "accepted" as const }),
    };

    act(() => {
      const event = new Event("beforeinstallprompt");
      Object.assign(event, fakePrompt);
      window.dispatchEvent(event);
    });

    expect(screen.getByText(/Installer l'application HCR/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /Installer/i })).toBeDefined();

    // Clic sur ignorer
    const ignoreButton = screen.getByRole("button", { name: /Ignorer/i });
    fireEvent.click(ignoreButton);

    expect(screen.queryByText(/Installer l'application HCR/i)).toBeNull();
    expect(localStorage.getItem("pwa_prompt_dismissed")).toBe("true");
  });

  it("ne s'affiche pas si pwa_prompt_dismissed est déjà dans localStorage", () => {
    localStorage.setItem("pwa_prompt_dismissed", "true");

    render(<PwaInstallPrompt />);

    act(() => {
      const event = new Event("beforeinstallprompt");
      Object.assign(event, { preventDefault: vi.fn() });
      window.dispatchEvent(event);
    });

    expect(screen.queryByText(/Installer l'application HCR/i)).toBeNull();
  });
});
