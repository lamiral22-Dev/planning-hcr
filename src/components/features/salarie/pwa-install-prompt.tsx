"use client";

import React, { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true); // Fermé par défaut jusqu'à vérification client

  useEffect(() => {
    // Vérification de la mémorisation du refus
    const dismissed = localStorage.getItem("pwa_prompt_dismissed");
    if (dismissed === "true") {
      return;
    }

    // Détection de l'état standalone actuel
    const isMediaStandalone =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches;
    const isNavStandalone =
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    const checkStandalone = Boolean(isMediaStandalone || isNavStandalone);

    setIsStandalone(checkStandalone);
    if (checkStandalone) {
      return;
    }

    // Détection iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    if (isIosDevice) {
      setIsDismissed(false);
    }

    // Détection de l'événement natif Chrome Android / Desktop
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsDismissed(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setIsDismissed(true);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem("pwa_prompt_dismissed", "true");
  };

  if (isStandalone || isDismissed) {
    return null;
  }

  return (
    <div className="w-full bg-slate-900 text-white rounded-2xl p-4 shadow-lg border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 mb-4 animate-in fade-in duration-300">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
          <span className="text-xl">📱</span>
        </div>
        <div className="text-left">
          <h4 className="text-sm font-bold text-slate-100">
            Installer l&apos;application HCR
          </h4>
          <p className="text-xs text-slate-400">
            {isIos
              ? 'Appuyez sur Partager ⎋ puis "Sur l\'écran d\'accueil ⊕" pour une expérience plein écran.'
              : "Ajoutez l&apos;application sur votre écran d&apos;accueil pour pointer en 1 clic."}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
        {deferredPrompt && (
          <button
            type="button"
            onClick={handleInstallClick}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-xs rounded-lg transition-colors"
          >
            Installer
          </button>
        )}
        <button
          type="button"
          onClick={handleDismiss}
          className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 font-medium transition-colors"
        >
          Ignorer
        </button>
      </div>
    </div>
  );
}
