import React from "react";
import { Button } from "@/components/ui/button";

export interface AcknowledgmentBannerProps {
  planningVersion: number;
  onAcknowledge: () => void;
  isLoading?: boolean;
}

export function AcknowledgmentBanner({
  planningVersion,
  onAcknowledge,
  isLoading,
}: AcknowledgmentBannerProps) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-blue-600 font-bold text-base">📋 Émargement obligatoire</span>
          <span className="text-xs bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">
            Version {planningVersion}
          </span>
        </div>
        <p className="text-xs text-blue-900 leading-relaxed">
          Conformément au code du travail et à la convention HCR, vous devez attester avoir pris
          connaissance de votre planning.
        </p>
      </div>

      <Button
        variant="default"
        size="lg"
        onClick={onAcknowledge}
        disabled={isLoading}
        className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 whitespace-nowrap shadow-xs"
      >
        {isLoading ? "Signature..." : "J'ai pris connaissance de mon planning"}
      </Button>
    </div>
  );
}
