"use client";

import React, { useState, useTransition } from "react";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertBanner } from "@/components/ui/alert-banner";
import { ProposeSwapModal, type Colleague, type UserShiftOption } from "./propose-swap-modal";
import { RejectSwapModal } from "./reject-swap-modal";
import { requestShiftSwap, respondToSwapRequest } from "@/actions/swap-actions";

export interface SwapItemData {
  id: string;
  shiftId: string;
  requesterId: string;
  targetUserId: string;
  status: string;
  reason?: string | null;
  rejectedReason?: string | null;
  createdAt: Date;
  requesterName: string;
  targetUserName: string;
  shiftDateStr: string;
  shiftTimeStr: string;
}

export interface BoursesViewProps {
  currentUserId: string;
  sentSwaps: SwapItemData[];
  receivedSwaps: SwapItemData[];
  myEligibleShifts: UserShiftOption[];
  colleagues: Colleague[];
  initialProposeShiftId?: string | null;
  onRefresh?: () => void;
}

export function BoursesView({
  sentSwaps,
  receivedSwaps,
  myEligibleShifts,
  colleagues,
  initialProposeShiftId,
  onRefresh,
}: BoursesViewProps) {
  const [activeTab, setActiveTab] = useState<string>("received");
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [isProposeModalOpen, setIsProposeModalOpen] = useState(Boolean(initialProposeShiftId));
  const [rejectingSwapId, setRejectingSwapId] = useState<string | null>(null);

  const pendingReceivedCount = receivedSwaps.filter((s) => s.status === "EN_ATTENTE_EQUIPIER").length;

  const handleProposeConfirm = (data: { shiftId: string; targetUserId: string; reason?: string }) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await requestShiftSwap(data);
      if (res.success) {
        setFeedback({ type: "success", text: "Demande d'échange envoyée au collègue avec succès !" });
        setIsProposeModalOpen(false);
        onRefresh?.();
      } else {
        setFeedback({ type: "error", text: res.error || "Erreur lors de l'envoi de la demande" });
      }
    });
  };

  const handleAccept = (swapId: string) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await respondToSwapRequest({ swapId, accepted: true });
      if (res.success) {
        setFeedback({
          type: "success",
          text: "Échange accepté et validé légalement ! Transmis pour validation finale au Manager.",
        });
        onRefresh?.();
      } else {
        setFeedback({
          type: "error",
          text: res.error || "Impossible d'accepter ce shift (règles légales HCR)",
        });
      }
    });
  };

  const handleRejectConfirm = (reason: string) => {
    if (!rejectingSwapId) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await respondToSwapRequest({
        swapId: rejectingSwapId,
        accepted: false,
        rejectedReason: reason,
      });

      if (res.success) {
        setFeedback({ type: "success", text: "Demande d'échange refusée." });
        setRejectingSwapId(null);
        onRefresh?.();
      } else {
        setFeedback({ type: "error", text: res.error || "Erreur lors du refus" });
      }
    });
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "EN_ATTENTE_EQUIPIER":
        return <Badge variant="warning">En attente équipier</Badge>;
      case "EN_ATTENTE_MANAGER":
        return <Badge variant="default">En attente manager</Badge>;
      case "VALIDE":
        return <Badge variant="success">Validé</Badge>;
      case "REFUSE":
        return <Badge variant="danger">Refusé</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-5 p-4 max-w-lg mx-auto pb-16">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Bourse d&apos;échanges</h1>
          <p className="text-xs text-gray-500">Échangez vos shifts entre collègues</p>
        </div>
        <Button
          variant="default"
          size="sm"
          onClick={() => setIsProposeModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 font-bold"
        >
          + Proposer un shift
        </Button>
      </div>

      {/* Retours et notifications */}
      {feedback && (
        <AlertBanner
          variant={feedback.type === "success" ? "success" : "danger"}
          title={feedback.type === "success" ? "Information" : "Non-conformité HCR"}
        >
          {feedback.text}
        </AlertBanner>
      )}

      {/* Onglets tactiles */}
      <Tabs
        tabs={[
          { id: "received", label: "Demandes reçues", count: pendingReceivedCount },
          { id: "sent", label: "Mes demandes envoyées", count: sentSwaps.length },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* Contenu onglet "Demandes reçues" */}
      {activeTab === "received" && (
        <div className="flex flex-col gap-3">
          {receivedSwaps.length === 0 ? (
            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-2">
              <span className="text-3xl">📬</span>
              <p className="font-semibold text-gray-800 text-sm">Aucune demande reçue</p>
              <p className="text-xs text-gray-500">
                Vous n&apos;avez aucune proposition d&apos;échange en attente pour le moment.
              </p>
            </div>
          ) : (
            receivedSwaps.map((swap) => (
              <div
                key={swap.id}
                className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs flex flex-col gap-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs text-gray-500 font-semibold block">Proposition de :</span>
                    <span className="font-bold text-gray-900 text-sm">{swap.requesterName}</span>
                  </div>
                  <div>{renderStatusBadge(swap.status)}</div>
                </div>

                <div className="bg-gray-50 rounded-xl p-3 text-xs flex flex-col gap-1 text-gray-700">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Date :</span>
                    <span className="font-bold text-gray-900">{swap.shiftDateStr}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Horaires :</span>
                    <span className="font-bold text-gray-900">{swap.shiftTimeStr}</span>
                  </div>
                  {swap.reason && (
                    <div className="border-t border-gray-200/60 pt-1 mt-1 text-gray-600 italic">
                      « {swap.reason} »
                    </div>
                  )}
                </div>

                {swap.status === "EN_ATTENTE_EQUIPIER" && (
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRejectingSwapId(swap.id)}
                      disabled={isPending}
                      className="flex-1 text-xs text-rose-600 hover:bg-rose-50 border-rose-200"
                    >
                      Refuser
                    </Button>
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => handleAccept(swap.id)}
                      disabled={isPending}
                      className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    >
                      {isPending ? "Contrôle..." : "Accepter le créneau"}
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Contenu onglet "Mes demandes envoyées" */}
      {activeTab === "sent" && (
        <div className="flex flex-col gap-3">
          {sentSwaps.length === 0 ? (
            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-2">
              <span className="text-3xl">📤</span>
              <p className="font-semibold text-gray-800 text-sm">Aucune demande envoyée</p>
              <p className="text-xs text-gray-500">
                Vous n&apos;avez envoyé aucune proposition d&apos;échange de shift.
              </p>
            </div>
          ) : (
            sentSwaps.map((swap) => (
              <div
                key={swap.id}
                className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs flex flex-col gap-2"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs text-gray-500 font-semibold block">Destinataire :</span>
                    <span className="font-bold text-gray-900 text-sm">{swap.targetUserName}</span>
                  </div>
                  <div>{renderStatusBadge(swap.status)}</div>
                </div>

                <div className="bg-gray-50 rounded-xl p-3 text-xs flex flex-col gap-1 text-gray-700">
                  <div className="flex justify-between">
                    <span>Créneau :</span>
                    <span className="font-bold">
                      {swap.shiftDateStr} ({swap.shiftTimeStr})
                    </span>
                  </div>
                  {swap.rejectedReason && (
                    <div className="text-rose-600 text-xs font-medium border-t border-gray-200/60 pt-1 mt-1">
                      Motif de refus : {swap.rejectedReason}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modals */}
      <ProposeSwapModal
        isOpen={isProposeModalOpen}
        onClose={() => setIsProposeModalOpen(false)}
        onConfirm={handleProposeConfirm}
        myShifts={myEligibleShifts}
        colleagues={colleagues}
        initialShiftId={initialProposeShiftId}
        isLoading={isPending}
      />

      <RejectSwapModal
        isOpen={Boolean(rejectingSwapId)}
        onClose={() => setRejectingSwapId(null)}
        onConfirm={handleRejectConfirm}
        isLoading={isPending}
      />
    </div>
  );
}
