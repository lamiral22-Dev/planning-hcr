"use client";

import React, { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { applyMasterTemplate, publishQuinzaine } from "@/actions/shift-actions";
import { MasterTemplateModal } from "./master-template-modal";

interface PlanningToolbarProps {
  startDate: Date;
  endDate: Date;
  onRefresh?: () => void;
  onOpenCreateModal?: () => void;
}

export function PlanningToolbar({
  startDate,
  endDate,
  onRefresh,
  onOpenCreateModal,
}: PlanningToolbarProps) {
  const [isPending, startTransition] = useTransition();
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  const handleDuplicateTemplate = () => {
    if (!confirm("Voulez-vous instancier la quinzaine à partir de la grille type ?")) {
      return;
    }
    startTransition(async () => {
      const res = await applyMasterTemplate(startDate);
      if (res.success) {
        alert("Planning type appliqué avec succès !");
        if (onRefresh) onRefresh();
      } else {
        alert(`Erreur : ${res.error}`);
      }
    });
  };

  const handlePublish = () => {
    if (!confirm("Voulez-vous publier tous les shifts brouillons de cette quinzaine ?")) {
      return;
    }
    startTransition(async () => {
      const res = await publishQuinzaine(startDate, endDate);
      if (res.success) {
        alert("Quinzaine publiée avec succès !");
        if (onRefresh) onRefresh();
      } else {
        alert(`Erreur : ${res.error}`);
      }
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white rounded-xl border border-slate-200 shadow-sm print:hidden">
        <div className="flex items-center gap-2">
          {onOpenCreateModal && (
            <Button
              onClick={onOpenCreateModal}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              + Créer un shift
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => setIsTemplateModalOpen(true)}
            className="border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            ⚙️ Gérer le planning type
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={handleDuplicateTemplate}
            disabled={isPending}
            className="border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            📋 Dupliquer depuis le planning type
          </Button>

          <Button
            onClick={handlePublish}
            disabled={isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
          >
            🚀 Publier la quinzaine
          </Button>

          <Button
            variant="outline"
            onClick={handlePrint}
            className="border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            📄 Exporter le planning en PDF
          </Button>
        </div>
      </div>

      <MasterTemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        onSuccess={onRefresh}
      />
    </>
  );
}
