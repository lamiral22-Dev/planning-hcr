import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface SalarieShiftCardProps {
  shift: {
    id: string;
    startTime: Date;
    endTime: Date;
    status: string;
    isLateModification?: boolean;
    acknowledgedAt?: Date | null;
    derogationAcceptedAt?: Date | null;
  };
  onOpenDerogation?: () => void;
  onProposeSwap?: () => void;
}

export function SalarieShiftCard({
  shift,
  onOpenDerogation,
  onProposeSwap,
}: SalarieShiftCardProps) {
  const start = new Date(shift.startTime);
  const end = new Date(shift.endTime);

  const dayStr = start.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const capitalizedDay = dayStr.charAt(0).toUpperCase() + dayStr.slice(1);

  const startTimeStr = start.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const endTimeStr = end.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const durationHours = (
    (end.getTime() - start.getTime()) /
    (1000 * 60 * 60)
  ).toFixed(1);

  const isPendingDerogation =
    shift.status === "EN_ATTENTE_DEROGATION" ||
    (shift.isLateModification && !shift.derogationAcceptedAt);

  return (
    <div
      className={`bg-white rounded-2xl p-4 border transition-all ${
        isPendingDerogation
          ? "border-amber-300 shadow-md bg-amber-50/20"
          : "border-gray-200 shadow-xs hover:border-gray-300"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
            {capitalizedDay}
          </span>
          <span className="text-lg font-bold text-gray-900">
            {startTimeStr} - {endTimeStr}
          </span>
        </div>

        <div>
          {isPendingDerogation ? (
            <Badge variant="warning">Accord dérogatoire requis</Badge>
          ) : shift.status === "PUBLIE" ? (
            <Badge variant="success">Publié</Badge>
          ) : (
            <Badge variant="secondary">{shift.status}</Badge>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-100 pt-3 mt-2">
        <span>Durée : {durationHours}h</span>

        <div className="flex items-center gap-2">
          {isPendingDerogation && onOpenDerogation && (
            <Button
              variant="danger"
              size="sm"
              onClick={onOpenDerogation}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
            >
              ⚠️ Donner mon accord
            </Button>
          )}

          {!isPendingDerogation && shift.status === "PUBLIE" && onProposeSwap && (
            <Button
              variant="outline"
              size="sm"
              onClick={onProposeSwap}
              className="text-xs"
            >
              🔄 Échanger
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
