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
import { respondToReplacementRequest } from "@/actions/restaurant-planning-actions";
import { createLeaveRequest } from "@/actions/leave-actions";
import { addDays, format, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { toAppTime } from "@/lib/time-utils";
import { Dialog } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { canReserveLeave, countLeaveDays, remainingLeaveDays } from "@/lib/leave-utils";
import { getFrenchPublicHolidays } from "@/lib/french-holidays";

export interface SalarieShiftData {
  id: string;
  startTime: Date;
  endTime: Date;
  status: string;
  isLateModification?: boolean;
  acknowledgedAt?: Date | null;
  derogationAcceptedAt?: Date | null;
  planningVersion?: number;
  leaveAction?: string | null;
}

export interface SalariePlanningViewProps {
  shifts: SalarieShiftData[];
  activeTimeEntryId?: string | null;
  activeClockInTime?: Date | null;
  isLoading?: boolean;
  onRefresh?: () => void;
  replacementRequests?: { id: string; proposedEmployee: string; startTime: Date; endTime: Date }[];
  leaves?: { id: string; type: string; status: string; startDate: string; endDate: string }[];
  cpBalance?: { hireDate: string; adjustment: number };
}

export function SalariePlanningView({
  shifts,
  activeTimeEntryId,
  activeClockInTime,
  isLoading,
  onRefresh,
  replacementRequests = [],
  leaves = [],
  cpBalance,
}: SalariePlanningViewProps) {
  const router = useRouter();
  const [periodStart, setPeriodStart] = useState(() => startOfDay(toAppTime(new Date())));
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveType, setLeaveType] = useState("CP");
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Gestion du modal de dérogation
  const [derogationTargetShift, setDerogationTargetShift] = useState<SalarieShiftData | null>(null);
  const [replacementQueue, setReplacementQueue] = useState(replacementRequests);

  // Recherche du shift en cours ou du prochain shift pour le widget de pointage
  const now = new Date();
  const todayKey = format(toAppTime(now), "yyyy-MM-dd");
  const requestedLeaveDays = leaveStart && leaveEnd && leaveEnd >= leaveStart
    ? countLeaveDays(leaveStart, leaveEnd)
    : 0;
  const reservations = leaves.filter((leave) => leave.type === "CP");
  const balanceDate = leaveStart || todayKey;
  const hireDate = cpBalance ? new Date(cpBalance.hireDate) : null;
  const cpRemainingDays = hireDate ? remainingLeaveDays(hireDate, cpBalance!.adjustment, reservations, balanceDate) : 0;
  const insufficientCp = leaveType === "CP" && (cpRemainingDays <= 0 ||
    (leaveStart && leaveEnd && leaveEnd >= leaveStart && hireDate
      ? !canReserveLeave(hireDate, cpBalance!.adjustment, reservations, { startDate: leaveStart, endDate: leaveEnd })
      : cpRemainingDays < requestedLeaveDays));
  const currentOrNextShift =
    shifts.find(
      (s) => new Date(s.endTime) >= now && s.status !== "ANNULE" && s.leaveAction !== "OVERRIDE"
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
        planningVersion: derogationTargetShift.planningVersion,
      });

      if (res.success) {
        setFeedback({
          type: "success",
          text: "Dérogation acceptée avec succès. Le créneau est maintenant publié.",
        });
        setDerogationTargetShift(null);
        router.refresh();
        onRefresh?.();
      } else {
        setFeedback({
          type: "error",
          text: res.error || "Erreur lors de l'acceptation de la dérogation",
        });
      }
    });
  };

  const handleReplacementResponse = (requestId: string, accepted: boolean) => {
    setFeedback(null);
    startTransition(async () => {
      const result = await respondToReplacementRequest(requestId, accepted);
      if (result.success) {
        setReplacementQueue((current) => current.filter((request) => request.id !== requestId));
        setFeedback({
          type: "success",
          text: accepted
            ? "Remplacement accepté. La nouvelle affectation reste soumise à votre accord dérogatoire."
            : "Remplacement refusé. Votre affectation est conservée.",
        });
        onRefresh?.();
      } else {
        setFeedback({ type: "error", text: result.error });
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

      <Button className="w-full min-h-14 text-base font-bold" onClick={() => setLeaveOpen(true)}>
        Demander un CP / RTT / Repos
      </Button>

      {/* Notifications feedback */}
      {feedback && (
        <AlertBanner
          variant={feedback.type === "success" ? "success" : "danger"}
          title={feedback.type === "success" ? "Succès" : "Attention"}
        >
          {feedback.text}
        </AlertBanner>
      )}

      {replacementQueue.map((request) => (
        <AlertBanner key={request.id} variant="warning" title="Accord préalable requis pour un remplacement">
          <p className="mb-3 text-sm">
            Le créneau du {new Date(request.startTime).toLocaleDateString("fr-FR")} vous est actuellement affecté.
            Le manager propose {request.proposedEmployee} à votre place. Votre affectation reste inchangée tant que vous n&apos;avez pas répondu.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={isPending} onClick={() => handleReplacementResponse(request.id, true)}>Accepter le remplacement</Button>
            <Button disabled={isPending} variant="outline" onClick={() => handleReplacementResponse(request.id, false)}>Refuser</Button>
          </div>
        </AlertBanner>
      ))}

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

      <div className="flex w-full flex-col gap-3">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
          Mes créneaux de travail
        </h2>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button variant="outline" className="h-auto min-h-10" onClick={() => setPeriodStart(addDays(periodStart, -15))}>
            ← 15 jours préc.
          </Button>
          <span className="text-center text-sm font-semibold">
            Du {format(periodStart, "d MMMM yyyy", { locale: fr })} au {format(addDays(periodStart, 14), "d MMMM yyyy", { locale: fr })}
          </span>
          <Button variant="outline" className="h-auto min-h-10" onClick={() => setPeriodStart(addDays(periodStart, 15))}>
            15 jours suiv. →
          </Button>
          <Button variant="outline" className="h-auto min-h-10" onClick={() => setPeriodStart(startOfDay(toAppTime(new Date())))}>
            Aujourd&apos;hui
          </Button>
        </div>
        <ul className="w-full space-y-2">
            {Array.from({ length: 15 }, (_, index) => {
              const day = addDays(periodStart, index);
              const key = format(day, "yyyy-MM-dd");
              const dayShifts = shifts.filter((shift) => format(toAppTime(new Date(shift.startTime)), "yyyy-MM-dd") === key);
              const dayLeaves = leaves.filter((leave) => leave.startDate <= key && leave.endDate >= key);
              const holiday = getFrenchPublicHolidays(day.getFullYear()).find((item) => item.date === key);
              return <li key={key} className={`flex gap-3 rounded-lg p-2 ${key === todayKey ? "bg-blue-50 ring-1 ring-blue-200" : "bg-gray-50"}`}>
                <h3 className="w-20 shrink-0 text-sm font-bold capitalize">
                  {format(day, "EEE d MMM", { locale: fr })}
                  {key === todayKey && <span className="block text-xs font-medium normal-case text-blue-700">Aujourd&apos;hui</span>}
                  {holiday && <span className="block text-xs font-medium normal-case text-amber-700">Férié · {holiday.name}</span>}
                </h3>
                <div className="min-w-0 flex-1 space-y-2">
                  {dayLeaves.map((leave) => <div key={leave.id} className={`rounded border p-2 text-sm font-semibold ${leave.status === "APPROUVE" ? "border-emerald-300 bg-emerald-50" : "border-orange-300 bg-orange-50"}`}>
                    {leave.type === "REPOS" ? "Repos" : leave.type === "AUTRE_MOTIF" ? "CP autre motif" : leave.type} · {leave.status === "APPROUVE" ? "Validé" : "En attente"}
                  </div>)}
                  {dayShifts.map((shift) => <SalarieShiftCard key={shift.id} shift={shift}
                    onOpenDerogation={() => setDerogationTargetShift(shift)}
                    onProposeSwap={() => { window.location.href = `/salarie/bourses?proposeShiftId=${shift.id}`; }} />)}
                  {!dayLeaves.length && !dayShifts.length && <p className="text-xs text-gray-500">Aucun créneau</p>}
                </div>
              </li>;
            })}
        </ul>
      </div>

      <Dialog isOpen={leaveOpen} onClose={() => setLeaveOpen(false)} title="Demander un congé ou repos">
        <form className="space-y-3" onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          startTransition(async () => {
            const result = await createLeaveRequest({ type: form.get("type"), startDate: form.get("startDate"), endDate: form.get("endDate"), reason: form.get("reason") });
            if (result.success) { setLeaveOpen(false); setFeedback({ type: "success", text: "Demande envoyée." }); router.refresh(); }
            else setFeedback({ type: "error", text: result.error });
          });
        }}>
          <label className="block text-sm">Type<select name="type" value={leaveType} onChange={(event) => setLeaveType(event.target.value)} className="mt-1 w-full rounded border p-2">
            <option value="CP">CP</option><option value="RTT">RTT</option><option value="REPOS">Repos</option>
            <option value="AUTRE_MOTIF">CP autre motif (Décès, mariage, événement familial...)</option>
          </select></label>
          <div className="rounded border border-blue-200 bg-blue-50 p-3 font-semibold text-blue-900">
            CP restants à la date choisie : {Math.max(0, cpRemainingDays).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} jours ·
            {" "}Période sélectionnée : {requestedLeaveDays} jour(s) décompté(s)
          </div>
          <label className="block text-sm">Début<input type="date" name="startDate" required value={leaveStart} onChange={(event) => setLeaveStart(event.target.value)} className="mt-1 w-full rounded border p-2" /></label>
          <label className="block text-sm">Fin<input type="date" name="endDate" required value={leaveEnd} onChange={(event) => setLeaveEnd(event.target.value)} className="mt-1 w-full rounded border p-2" /></label>
          <label className="block text-sm">{leaveType === "AUTRE_MOTIF" ? "Motif obligatoire" : "Motif facultatif"}<textarea name="reason" value={leaveReason} onChange={(event) => setLeaveReason(event.target.value)} required={leaveType === "AUTRE_MOTIF"} maxLength={1000} className="mt-1 w-full rounded border p-2" /></label>
          {insufficientCp && <p role="alert" className="text-red-700">Solde de CP insuffisant : la prise de CP anticipés n&apos;est pas autorisée.</p>}
          {feedback?.type === "error" && <p role="alert" className="text-red-700">{feedback.text}</p>}
          <Button type="submit" disabled={isPending || insufficientCp || (leaveType === "AUTRE_MOTIF" && !leaveReason.trim())}>Envoyer la demande</Button>
        </form>
      </Dialog>

      {/* Dialogue modal d'accord dérogatoire */}
      {derogationTargetShift && (
        <DerogationModal
          isOpen={Boolean(derogationTargetShift)}
          onClose={() => setDerogationTargetShift(null)}
          onConfirm={handleConfirmDerogation}
          isLoading={isPending}
          leaveAction={derogationTargetShift.leaveAction}
          planningVersion={derogationTargetShift.planningVersion}
          shiftInfo={{
            dateStr: new Date(derogationTargetShift.startTime).toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              timeZone: "Europe/Paris",
            }),
            timeRangeStr: `${new Date(derogationTargetShift.startTime).toLocaleTimeString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Europe/Paris",
            })} - ${new Date(derogationTargetShift.endTime).toLocaleTimeString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Europe/Paris",
            })}`,
          }}
        />
      )}
    </div>
  );
}
