"use client";

import React, { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface DerogationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (comment?: string) => void;
  shiftInfo: {
    dateStr: string;
    timeRangeStr: string;
  };
  isLoading?: boolean;
}

export function DerogationModal({
  isOpen,
  onClose,
  onConfirm,
  shiftInfo,
  isLoading,
}: DerogationModalProps) {
  const [hasAgreed, setHasAgreed] = useState(false);
  const [comment, setComment] = useState("");

  const handleConfirm = () => {
    if (!hasAgreed) return;
    onConfirm(comment.trim() ? comment.trim() : undefined);
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Accord dérogatoire requis (Délai < 8 jours)"
      description="Ce shift a été modifié ou attribué à moins de 8 jours calendaires."
    >
      <div className="flex flex-col gap-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-900">
          <p className="font-semibold">Créneau concerné :</p>
          <p>
            {shiftInfo.dateStr} de {shiftInfo.timeRangeStr}
          </p>
          <p className="text-xs text-amber-700 mt-2">
            Conformément aux règles HCR et au cahier des charges, votre accord
            exprès est légalement requis pour intégrer cette modification tardive.
          </p>
        </div>

        {/* Case à cocher obligatoire avec formulation stricte du CdC */}
        <label className="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-xl p-3.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={hasAgreed}
            onChange={(e) => setHasAgreed(e.target.checked)}
            className="mt-0.5 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
          <span className="text-sm font-semibold text-gray-900 leading-snug">
            J&apos;accepte expressément la modification de mon planning à titre dérogatoire
          </span>
        </label>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="derogation-comment"
            className="text-xs font-medium text-gray-600"
          >
            Commentaire optionnel du salarié :
          </label>
          <input
            id="derogation-comment"
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Ex : Accord pour dépanner l'équipe"
            className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1"
          >
            Refuser / Fermer
          </Button>
          <Button
            variant="default"
            onClick={handleConfirm}
            disabled={!hasAgreed || isLoading}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? "Enregistrement..." : "Confirmer l'accord"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
