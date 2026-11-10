"use client";

import React, { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global application error:", error);
  }, [error]);

  return (
    <html lang="fr">
      <body className="antialiased min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-rose-200 p-8 text-center flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-3xl">
            🚨
          </div>

          <h1 className="text-xl font-black text-rose-900 tracking-tight">
            Une erreur critique est survenue
          </h1>
          <p className="text-xs text-gray-600 max-w-xs">
            L&apos;application a rencontré un dysfonctionnement inattendu. Vos données et pointages restent sécurisés.
          </p>

          {error?.digest && (
            <div className="text-[10px] text-gray-400 bg-gray-50 px-2 py-1 rounded font-mono">
              Réf : {error.digest}
            </div>
          )}

          <div className="flex gap-3 w-full mt-2">
            <button
              onClick={() => reset()}
              className="flex-1 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs transition-colors"
            >
              Réessayer
            </button>
            <button
              onClick={() => {
                window.location.href = "/login";
              }}
              className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-xl text-xs transition-colors"
            >
              Retour à l&apos;accueil
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
