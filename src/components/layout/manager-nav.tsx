"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavLinkItem {
  href: string;
  label: string;
}

const navItems: NavLinkItem[] = [
  { href: "/manager/planning", label: "Planning Quinzaine" },
  { href: "/manager/arbitrage", label: "Arbitrage & Bourse" },
  { href: "/manager/exports", label: "Exports Paie" },
  { href: "/manager/equipe", label: "Équipe" },
  { href: "/manager/audit", label: "Registre d'Audit" },
];

export function ManagerNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center space-x-1" aria-label="Navigation principale manager">
      {navItems.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/manager" && pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3.5 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? "bg-blue-50 text-blue-700 font-semibold"
                : "text-slate-700 hover:text-blue-700 hover:bg-slate-100"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
