"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";

interface ManagerShiftBadgeProps {
  status: "BROUILLON" | "PUBLIE" | "EN_ATTENTE_DEROGATION" | "ANNULE";
  isLate?: boolean;
  hasDailyRestViolation?: boolean;
}

export function ManagerShiftBadge({
  status,
  isLate,
  hasDailyRestViolation,
}: ManagerShiftBadgeProps) {
  let badgeVariant: "default" | "secondary" | "danger" | "outline" | "warning" | "success" = "default";
  let label = status as string;

  switch (status) {
    case "BROUILLON":
      badgeVariant = "outline";
      label = "Brouillon";
      break;
    case "PUBLIE":
      badgeVariant = "success";
      label = "Publié";
      break;
    case "EN_ATTENTE_DEROGATION":
      badgeVariant = "warning";
      label = "Attente dérog.";
      break;
    case "ANNULE":
      badgeVariant = "danger";
      label = "Annulé";
      break;
  }

  return (
    <div className="flex flex-col gap-1 items-start">
      <Badge variant={badgeVariant} className="text-[10px] px-1.5 py-0.5 font-medium">
        {label}
      </Badge>
      {isLate && (
        <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1 rounded border border-amber-200">
          J &lt; 8
        </span>
      )}
      {hasDailyRestViolation && (
        <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 px-1 rounded border border-rose-200">
          ⚠️ Repos &lt; 11h
        </span>
      )}
    </div>
  );
}
