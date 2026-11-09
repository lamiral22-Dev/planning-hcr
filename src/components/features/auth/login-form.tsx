"use client";

import React, { useState, useTransition } from "react";
import { quickLoginByEmail, loginWithCredentials } from "@/actions/auth-actions";

interface LoginFormProps {
  isDemoMode: boolean;
}

export function LoginForm({ isDemoMode }: LoginFormProps) {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleQuickLogin = (email: string) => {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await quickLoginByEmail(email);
      } catch (err: unknown) {
        if (err instanceof Error && !err.message.includes("NEXT_REDIRECT")) {
          setErrorMsg(err.message);
        }
      }
    });
  };

  const handleStandardLogin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMsg(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        await loginWithCredentials(formData);
      } catch (err: unknown) {
        if (err instanceof Error && !err.message.includes("NEXT_REDIRECT")) {
          setErrorMsg(err.message);
        }
      }
    });
  };

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-200 p-6 flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">
          Planning & Pointage HCR
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          {isDemoMode
            ? "Environnement de test & Démonstration en ligne"
            : "Espace d'authentification sécurisé"}
        </p>
      </div>

      {isDemoMode && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl p-3 flex items-center gap-2">
          <span>⚠️</span>
          <span className="font-medium">
            Environnement de test actif — Comptes pré-configurés disponibles
          </span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3 flex items-center gap-2">
          <span>⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Mode Démo : Boutons de connexion en 1 clic */}
      {isDemoMode && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider text-center">
            Connexion rapide en 1 clic
          </p>

          <button
            type="button"
            onClick={() => handleQuickLogin("thomas@resto.fr")}
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl text-sm transition-all shadow-sm disabled:opacity-50"
          >
            🟢 Se connecter en tant que Thomas (Salarié)
          </button>

          <button
            type="button"
            onClick={() => handleQuickLogin("sarah@resto.fr")}
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold rounded-xl text-sm transition-all shadow-sm disabled:opacity-50"
          >
            🟣 Se connecter en tant que Sarah (Salarié)
          </button>

          <button
            type="button"
            onClick={() => handleQuickLogin("manager@resto.fr")}
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white font-bold rounded-xl text-sm transition-all shadow-sm disabled:opacity-50"
          >
            👔 Se connecter en tant que Manager
          </button>
        </div>
      )}

      {/* Formulaire standard (Toujours présent en production, secondaire en mode démo) */}
      <form onSubmit={handleStandardLogin} className="flex flex-col gap-4">
        {isDemoMode && (
          <div className="relative my-1">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-400 font-semibold">
                Ou connexion par mot de passe
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="email"
            className="text-xs font-bold text-gray-700 tracking-wide uppercase"
          >
            Adresse email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="nom@resto.fr"
            disabled={isPending}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all disabled:opacity-50"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="password"
            className="text-xs font-bold text-gray-700 tracking-wide uppercase"
          >
            Mot de passe
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            disabled={isPending}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-bold rounded-xl text-sm transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isPending ? (
            <span className="inline-block animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            "Se connecter"
          )}
        </button>
      </form>

      {/* Mode Démo : Bouton discret de réinitialisation */}
      {isDemoMode && (
        <div className="border-t border-gray-100 pt-3 text-center">
          <a
            href="/api/dev/seed"
            className="text-xs text-gray-500 hover:text-gray-800 font-medium inline-flex items-center gap-1.5 py-1 px-3 rounded-lg hover:bg-gray-100 transition-colors"
          >
            ⚙️ Réinitialiser les données de test
          </a>
        </div>
      )}
    </div>
  );
}
