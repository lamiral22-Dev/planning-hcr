"use client";

import React, { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ClockOutDiscrepancyModal } from "./clock-out-discrepancy-modal";
import { clockIn, clockOut } from "@/actions/time-actions";
import { roundClockOutTime } from "@/lib/hcr-rules";

export interface ClockWidgetProps {
  activeTimeEntryId?: string | null;
  activeClockInTime?: Date | null;
  currentShift?: {
    id: string;
    startTime: Date;
    endTime: Date;
  } | null;
  onEntryChange?: () => void;
}

export function ClockWidget({
  activeTimeEntryId,
  activeClockInTime,
  currentShift,
  onEntryChange,
}: ClockWidgetProps) {
  // Protection contre l'hydration mismatch SSR
  const [isMounted, setIsMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    setCurrentTime(new Date());
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatHoursMinutes = (d: Date) =>
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  const formatTimeSeconds = (d: Date) =>
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const isWorking = Boolean(activeTimeEntryId);

  // Prise de poste (aucun userId passé par le client)
  const handleClockIn = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const res = await clockIn({ shiftId: currentShift?.id });
      if (res.success) {
        setSuccessMsg("Prise de poste enregistrée avec succès !");
        onEntryChange?.();
      } else {
        setErrorMsg(res.error || "Échec lors de la prise de poste");
      }
    });
  };

  // Fin de service
  const handleClockOutClick = () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    // Vérifier si un motif d'écart est requis
    const now = new Date();
    if (currentShift) {
      const scheduledEnd = new Date(currentShift.endTime);
      const diffMinutes = Math.abs(now.getTime() - scheduledEnd.getTime()) / (1000 * 60);

      // Si écart de plus de 10 min par rapport à la fin prévue -> ouverture modal
      if (diffMinutes > 10) {
        setIsModalOpen(true);
        return;
      }
    }

    // Sortie directe sans modal d'écart
    performClockOut();
  };

  const performClockOut = (discrepancyReason?: string) => {
    if (!activeTimeEntryId) return;

    startTransition(async () => {
      const res = await clockOut({
        timeEntryId: activeTimeEntryId,
        discrepancyReason,
      });

      if (res.success) {
        setSuccessMsg("Fin de service enregistrée avec succès !");
        setIsModalOpen(false);
        onEntryChange?.();
      } else {
        setErrorMsg(res.error || "Échec lors de la fin de service");
      }
    });
  };

  const now = currentTime || new Date();
  const roundedNow = roundClockOutTime(now, 15, "nearest");

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex flex-col gap-4">
      {/* En-tête avec Horloge live protégée */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isWorking ? "bg-emerald-400" : "bg-blue-400"
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-3 w-3 ${
                isWorking ? "bg-emerald-500" : "bg-blue-600"
              }`}
            />
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
            {isWorking ? "Service en cours" : "Prêt à pointer"}
          </span>
        </div>

        {/* Heure live isolée pour éviter le mismatch SSR */}
        <div className="text-right">
          <span className="text-xl font-mono font-bold text-gray-900" suppressHydrationWarning>
            {isMounted && currentTime ? formatTimeSeconds(currentTime) : "--:--:--"}
          </span>
        </div>
      </div>

      {/* Informations de shift en cours */}
      {currentShift && (
        <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600 flex justify-between items-center">
          <span>Créneau prévu :</span>
          <span className="font-semibold text-gray-900">
            {formatHoursMinutes(new Date(currentShift.startTime))} -{" "}
            {formatHoursMinutes(new Date(currentShift.endTime))}
          </span>
        </div>
      )}

      {/* État en service */}
      {isWorking && activeClockInTime && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex justify-between items-center">
          <span>Prise de poste enregistrée à :</span>
          <span className="font-bold">
            {formatHoursMinutes(new Date(activeClockInTime))}
          </span>
        </div>
      )}

      {/* Messages de retour */}
      {errorMsg && (
        <p className="text-xs text-rose-600 font-semibold bg-rose-50 p-2.5 rounded-lg border border-rose-200">
          ⚠️ {errorMsg}
        </p>
      )}
      {successMsg && (
        <p className="text-xs text-emerald-700 font-semibold bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
          ✓ {successMsg}
        </p>
      )}

      {/* Gros boutons tactiles adaptés au mobile (h-16) */}
      {!isWorking ? (
        <Button
          size="xl"
          variant="success"
          onClick={handleClockIn}
          disabled={isPending}
          className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md active:bg-emerald-800"
        >
          {isPending ? "Pointage en cours..." : "🟢 PRISE DE POSTE (Clock In)"}
        </Button>
      ) : (
        <Button
          size="xl"
          variant="danger"
          onClick={handleClockOutClick}
          disabled={isPending}
          className="bg-rose-600 hover:bg-rose-700 text-white shadow-md active:bg-rose-800"
        >
          {isPending ? "Pointage en cours..." : "🔴 FIN DE SERVICE (Clock Out)"}
        </Button>
      )}

      {/* Dialogue obligatoire de motif d'écart */}
      <ClockOutDiscrepancyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={(reason) => performClockOut(reason)}
        rawTime={now}
        roundedTime={roundedNow}
        scheduledEndTime={currentShift ? new Date(currentShift.endTime) : undefined}
        isLoading={isPending}
      />
    </div>
  );
}
