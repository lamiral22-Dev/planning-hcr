import React from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { logout } from "@/actions/auth-actions";

export const metadata = {
  title: "Espace Manager - Planning & Pointage HCR",
};

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user || (user.role !== "MANAGER" && user.role !== "SUPER_ADMIN")) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Navigation Desktop / Tablette */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo et Titre */}
            <div className="flex items-center gap-6">
              <Link href="/manager/planning" className="flex items-center gap-2">
                <span className="text-xl font-black bg-gradient-to-r from-blue-700 to-indigo-800 bg-clip-text text-transparent">
                  HCR Manager
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold uppercase tracking-wider">
                  {user.role}
                </span>
              </Link>

              {/* 3 Onglets Principaux */}
              <nav className="flex items-center space-x-1" aria-label="Navigation principale manager">
                <Link
                  href="/manager/planning"
                  className="px-3.5 py-2 rounded-md text-sm font-medium text-slate-700 hover:text-blue-700 hover:bg-slate-100 transition-colors"
                >
                  Planning Quinzaine
                </Link>
                <Link
                  href="/manager/arbitrage"
                  className="px-3.5 py-2 rounded-md text-sm font-medium text-slate-700 hover:text-blue-700 hover:bg-slate-100 transition-colors"
                >
                  Arbitrage & Bourse
                </Link>
                <Link
                  href="/manager/exports"
                  className="px-3.5 py-2 rounded-md text-sm font-medium text-slate-700 hover:text-blue-700 hover:bg-slate-100 transition-colors"
                >
                  Exports Paie
                </Link>
              </nav>
            </div>

            {/* Profil et Déconnexion */}
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-900">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-slate-500">{user.email}</p>
              </div>

              <form action={logout}>
                <button
                  type="submit"
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors"
                >
                  Déconnexion
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}
