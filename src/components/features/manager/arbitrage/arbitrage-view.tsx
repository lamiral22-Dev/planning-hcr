"use client";

import React, { useState } from "react";
import { ContradictoryTable, type DiscrepancyItem } from "./contradictory-table";
import { SwapArbitrationList, type PendingSwapItem } from "./swap-arbitration-list";
import { Skeleton } from "@/components/ui/skeleton";

interface ArbitrageViewProps {
  discrepancies: DiscrepancyItem[];
  swaps: PendingSwapItem[];
  isLoading?: boolean;
}

export function ArbitrageView({
  discrepancies,
  swaps,
  isLoading = false,
}: ArbitrageViewProps) {
  const [activeTab, setActiveTab] = useState<"discrepancies" | "swaps">("discrepancies");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Console d&apos;Arbitrage & Bourse
        </h1>
        <p className="text-sm text-slate-500">
          Validation contradictoire des pointages en écart et décision managériale sur la bourse d&apos;échanges.
        </p>
      </div>

      {/* Onglets Desktop */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("discrepancies")}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "discrepancies"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Pointages en anomalie & imprévus
          {discrepancies.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800">
              {discrepancies.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("swaps")}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "swaps"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Bourse d&apos;échanges en attente
          {swaps.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800">
              {swaps.length}
            </span>
          )}
        </button>
      </div>

      {/* Contenu selon l'onglet actif */}
      {activeTab === "discrepancies" ? (
        <ContradictoryTable
          items={discrepancies}
          onRefresh={() => {
            window.location.reload();
          }}
        />
      ) : (
        <SwapArbitrationList
          swaps={swaps}
          onSuccess={() => {
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
