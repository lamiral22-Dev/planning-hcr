"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { arbitrateShiftSwap } from "@/actions/swap-actions";

export interface PendingSwapItem {
  id: string;
  shiftId: string;
  shiftDate: Date | string;
  shiftTime: string;
  requesterName: string;
  targetUserName: string;
  reason?: string | null;
}

interface SwapArbitrationListProps {
  swaps: PendingSwapItem[];
  onSuccess: () => void;
}

export function SwapArbitrationList({ swaps, onSuccess }: SwapArbitrationListProps) {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleApprove = async (swapId: string) => {
    setIsSubmitting(true);
    setActionError(null);
    const res = await arbitrateShiftSwap({
      swapId,
      approved: true,
    });
    if (res.success) {
      setIsSubmitting(false);
      onSuccess();
    } else {
      setActionError(res.error);
      setIsSubmitting(false);
    }
  };

  const handleRejectConfirm = async (swapId: string) => {
    setIsSubmitting(true);
    setActionError(null);
    const res = await arbitrateShiftSwap({
      swapId,
      approved: false,
      rejectedReason: rejectReason.trim() || "Refusé par la direction",
    });
    if (res.success) {
      setIsSubmitting(false);
      setRejectingId(null);
      setRejectReason("");
      onSuccess();
    } else {
      setActionError(res.error);
      setIsSubmitting(false);
    }
  };

  if (swaps.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-sm">
        Aucune demande d&apos;échange en attente d&apos;arbitrage managérial.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          {actionError}
        </div>
      )}

      <div className="divide-y divide-slate-200 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {swaps.map((swap) => (
          <div key={swap.id} className="p-4 sm:p-5 flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-slate-900 text-sm">
                  {swap.requesterName}
                </span>
                <span className="text-slate-400">➔</span>
                <span className="font-bold text-slate-900 text-sm">
                  {swap.targetUserName}
                </span>
              </div>
              <div className="text-xs text-slate-500">
                Shift du {format(new Date(swap.shiftDate), "EEEE dd MMMM yyyy", { locale: fr })} ({swap.shiftTime})
              </div>
              {swap.reason && (
                <div className="text-xs italic text-slate-600 mt-1">
                  &laquo; {swap.reason} &raquo;
                </div>
              )}
            </div>

            {rejectingId === swap.id ? (
              <div className="w-full sm:w-auto flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="Motif de refus..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="border border-slate-300 rounded px-2.5 py-1 text-xs"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRejectingId(null)}
                    disabled={isSubmitting}
                  >
                    Annuler
                  </Button>
                  <Button
                    size="sm"
                    disabled={isSubmitting}
                    onClick={() => handleRejectConfirm(swap.id)}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    Confirmer le refus
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRejectingId(swap.id)}
                  disabled={isSubmitting}
                  className="text-red-700 border-red-200 hover:bg-red-50 text-xs"
                >
                  Refuser
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleApprove(swap.id)}
                  disabled={isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                >
                  Valider l&apos;échange
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
