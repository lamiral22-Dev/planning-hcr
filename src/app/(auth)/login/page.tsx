"use client";

import React, { useState, useTransition } from "react";
import { quickLoginByEmail } from "@/actions/auth-actions";

export default function LoginPage() {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = (email: string) => {
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

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-200 p-6 flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            Planning & Pointage HCR
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Environnement de test & Démonstration en ligne Vercel
          </p>
        </div>

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3">
            ⚠️ {errorMsg}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider text-center">
            Connexion rapide en 1 clic
          </p>

          {/* Bouton Thomas */}
          <button
            onClick={() => handleLogin("thomas@resto.fr")}
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl text-sm transition-all shadow-sm disabled:opacity-50"
          >
            🟢 Se connecter en tant que Thomas (Salarié)
          </button>

          {/* Bouton Sarah */}
          <button
            onClick={() => handleLogin("sarah@resto.fr")}
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold rounded-xl text-sm transition-all shadow-sm disabled:opacity-50"
          >
            🟣 Se connecter en tant que Sarah (Salarié)
          </button>

          {/* Bouton Manager */}
          <button
            onClick={() => handleLogin("manager@resto.fr")}
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white font-bold rounded-xl text-sm transition-all shadow-sm disabled:opacity-50"
          >
            👔 Se connecter en tant que Manager
          </button>
        </div>

        {/* Bouton discret de réinitialisation */}
        <div className="border-t border-gray-100 pt-4 text-center">
          <a
            href="/api/dev/seed"
            className="text-xs text-gray-500 hover:text-gray-800 font-medium inline-flex items-center gap-1.5 py-1 px-3 rounded-lg hover:bg-gray-100 transition-colors"
          >
            ⚙️ Réinitialiser les données de test
          </a>
        </div>
      </div>
    </div>
  );
}
