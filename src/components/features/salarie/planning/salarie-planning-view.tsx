"use client";

import React, { useState, useTransition } from "react";
import { ClockWidget } from "@/components/features/salarie/time-tracking/clock-widget";
import { SalarieShiftCard } from "./salarie-shift-card";
import { AcknowledgmentBanner } from "./acknowledgment-banner";
import { DerogationModal } from "./derogation-modal";
import { PwaInstallPrompt } from "@/components/features/salarie/pwa-install-prompt";
import { AlertBanner } from "@/components/ui/alert-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { acknowledgeShift, acceptDerogation } from "@/actions/shift-actions";

export interface SalarieShiftData {
  id: string;
  startTime: Date;
  endTime: Date;
  status: string;
  isLateModification?: boolean;
  acknowledgedAt?: Date | null;
  derogationAcceptedAt?: Date | null;
  planningVersion?: number;
}

export interface SalariePlanningViewProps {
  shifts: SalarieShiftData[];
  activeTimeEntryId?: string | null;
  activeClockInTime?: Date | null;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function SalariePlanningView({
  shifts,
  activeTimeEntryId,
  activeClockInTime,
  isLoading,
  onRefresh,
}: SalariePlanningViewProps) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Gestion du modal de dérogation
  const [derogationTargetShift, setDerogationTargetShift] = useState<SalarieShiftData | null>(null);

  // Recherche du shift en cours ou du prochain shift pour le widget de pointage
  const now = new Date();
  const currentOrNextShift =
    shifts.find(
      (s) => new Date(s.endTime) >= now && s.status !== "ANNULE"
    ) || null;

  // Calcul du besoin d'émargement global
  const unacknowledgedShift = shifts.find(
    (s) => !s.acknowledgedAt && s.status === "PUBLIE"
  );
  const currentPlanningVersion = shifts.reduce(
    (max, s) => Math.max(max, s.planningVersion || 1),
    1
  );

  // Détection des shifts avec dérogation en attente
  const pendingDerogationShifts = shifts.filter(
    (s) => s.status === "EN_ATTENTE_DEROGATION" || (s.isLateModification && !s.derogationAcceptedAt)
  );

  const handleAcknowledge = () => {
    if (!unacknowledgedShift) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await acknowledgeShift({ shiftId: unacknowledgedShift.id });
      if (res.success) {
        setFeedback({ type: "success", text: "Planning émargé avec succès !" });
        onRefresh?.();
      } else {
        setFeedback({ type: "error", text: res.error || "Erreur lors de l'émargement" });
      }
    });
  };

  const handleConfirmDerogation = (comment?: string) => {
    if (!derogationTargetShift) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await acceptDerogation({
        shiftId: derogationTargetShift.id,
        comment,
      });

      if (res.success) {
        setFeedback({
          type: "success",
          text: "Dérogation acceptée avec succès. Le créneau est maintenant publié.",
        });
        setDerogationTargetShift(null);
        onRefresh?.();
      } else {
        setFeedback({
          type: "error",
          text: res.error || "Erreur lors de l'acceptation de la dérogation",
        });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-4 max-w-lg mx-auto pb-16">
      {/* Bannière non-intrusive d'installation PWA */}
      <PwaInstallPrompt />

      {/* En-tête avec bouton PDF */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Mon Planning</h1>
          <p className="text-xs text-gray-500">Espace Salarié HCR</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.print()}
          className="flex items-center gap-1.5 text-xs font-semibold"
        >
          📄 Télécharger PDF
        </Button>
      </div>

      {/* Widget de pointage de service */}
      <ClockWidget
        activeTimeEntryId={activeTimeEntryId}
        activeClockInTime={activeClockInTime}
        currentShift={
          currentOrNextShift
            ? {
                id: currentOrNextShift.id,
                startTime: new Date(currentOrNextShift.startTime),
                endTime: new Date(currentOrNextShift.endTime),
              }
            : null
        }
        onEntryChange={onRefresh}
      />

      {/* Notifications feedback */}
      {feedback && (
        <AlertBanner
          variant={feedback.type === "success" ? "success" : "danger"}
          title={feedback.type === "success" ? "Succès" : "Attention"}
        >
          {feedback.text}
        </AlertBanner>
      )}

      {/* Bannière bloquante d'accord dérogatoire (J < 8) */}
      {pendingDerogationShifts.length > 0 && (
        <AlertBanner
          variant="warning"
          title="⚠️ Accord dérogatoire formel requis"
        >
          <p className="mb-2">
            Un ou plusieurs créneaux ont été ajoutés ou modifiés à moins de 8 jours de leur début.
            Votre accord formel est requis pour valider ces modifications.
          </p>
          <Button
            size="sm"
            variant="danger"
            onClick={() => setDerogationTargetShift(pendingDerogationShifts[0])}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold w-full sm:w-auto"
          >
            Examiner la dérogation
          </Button>
        </AlertBanner>
      )}

      {/* Bannière d'émargement légal si planning en attente */}
      {unacknowledgedShift && pendingDerogationShifts.length === 0 && (
        <AcknowledgmentBanner
          planningVersion={currentPlanningVersion}
          onAcknowledge={handleAcknowledge}
          isLoading={isPending}
        />
      )}

      {/* Liste chronologique des shifts */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
          Mes créneaux de travail
        </h2>

        {shifts.length === 0 ? (
          <div className="bg-gray-50 border border-dashed border-gray-300 rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-2">
            <span className="text-3xl">☕</span>
            <p className="font-semibold text-gray-800 text-sm">Aucun shift planifié</p>
            <p className="text-xs text-gray-500 max-w-xs">
              Aucun créneau ne vous est affecté pour cette période. Profitez de votre repos légal !
            </p>
          </div>
        ) : (
          shifts.map((shift) => (
            <SalarieShiftCard
              key={shift.id}
              shift={shift}
              onOpenDerogation={() => setDerogationTargetShift(shift)}
              onProposeSwap={() => {
                window.location.href = `/salarie/bourses?proposeShiftId=${shift.id}`;
              }}
            />
          ))
        )}
      </div>

      {/* Dialogue modal d'accord dérogatoire */}
      {derogationTargetShift && (
        <DerogationModal
          isOpen={Boolean(derogationTargetShift)}
          onClose={() => setDerogationTargetShift(null)}
          onConfirm={handleConfirmDerogation}
          isLoading={isPending}
          shiftInfo={{
            dateStr: new Date(derogationTargetShift.startTime).toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            }),
            timeRangeStr: `${new Date(derogationTargetShift.startTime).toLocaleTimeString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
            })} - ${new Date(derogationTargetShift.endTime).toLocaleTimeString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
            })}`,
          }}
        />
      )}
    </div>
  );
}
