"use client";

import React, { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  getMasterTemplates,
  upsertMasterTemplate,
  deleteMasterTemplate,
} from "@/actions/template-actions";

export interface MasterTemplateItem {
  id: string;
  name: string;
  weekNumber: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  roleTarget: "SALARIE" | "MANAGER" | "SUPER_ADMIN";
  isActive: boolean;
}

interface MasterTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const DAYS_OF_WEEK = [
  { id: 1, label: "Lundi" },
  { id: 2, label: "Mardi" },
  { id: 3, label: "Mercredi" },
  { id: 4, label: "Jeudi" },
  { id: 5, label: "Vendredi" },
  { id: 6, label: "Samedi" },
  { id: 7, label: "Dimanche" },
];

export function MasterTemplateModal({
  isOpen,
  onClose,
  onSuccess,
}: MasterTemplateModalProps) {
  const [activeWeek, setActiveWeek] = useState<number>(1);
  const [templates, setTemplates] = useState<MasterTemplateItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mode formulaire (ajout ou édition)
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    weekNumber: number;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    roleTarget: "SALARIE" | "MANAGER" | "SUPER_ADMIN";
    isActive: boolean;
  }>({
    name: "Service Midi",
    weekNumber: 1,
    dayOfWeek: 1,
    startTime: "11:30",
    endTime: "15:00",
    roleTarget: "SALARIE",
    isActive: true,
  });

  const [isPending, startTransition] = useTransition();

  const loadTemplates = async () => {
    setIsLoading(true);
    setError(null);
    const res = await getMasterTemplates();
    if (res.success && Array.isArray(res.data)) {
      setTemplates(res.data as MasterTemplateItem[]);
    } else if (!res.success) {
      setError(res.error || "Erreur lors du chargement des créneaux types.");
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      setIsEditing(false);
      setEditingId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentWeekTemplates = templates.filter(
    (t) => t.weekNumber === activeWeek
  );

  const handleStartCreate = () => {
    setEditingId(null);
    setFormData({
      name: "Service Midi",
      weekNumber: activeWeek,
      dayOfWeek: 1,
      startTime: "11:30",
      endTime: "15:00",
      roleTarget: "SALARIE",
      isActive: true,
    });
    setIsEditing(true);
  };

  const handleStartEdit = (tpl: MasterTemplateItem) => {
    setEditingId(tpl.id);
    setFormData({
      name: tpl.name,
      weekNumber: tpl.weekNumber,
      dayOfWeek: tpl.dayOfWeek,
      startTime: tpl.startTime,
      endTime: tpl.endTime,
      roleTarget: tpl.roleTarget,
      isActive: tpl.isActive,
    });
    setIsEditing(true);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Voulez-vous supprimer définitivement ce créneau type ?")) return;
    startTransition(async () => {
      const res = await deleteMasterTemplate(id);
      if (res.success) {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
        if (onSuccess) onSuccess();
      } else {
        alert(`Erreur : ${res.error}`);
      }
    });
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await upsertMasterTemplate({
        id: editingId ?? undefined,
        name: formData.name,
        weekNumber: formData.weekNumber,
        dayOfWeek: formData.dayOfWeek,
        startTime: formData.startTime,
        endTime: formData.endTime,
        roleTarget: formData.roleTarget,
        isActive: formData.isActive,
      });

      if (res.success) {
        setIsEditing(false);
        setEditingId(null);
        await loadTemplates();
        if (onSuccess) onSuccess();
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Configuration de la Grille Type (Master Template)
            </h2>
            <p className="text-xs text-slate-500">
              Définissez les créneaux récurrents de la quinzaine pour instancier automatiquement vos plannings.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold text-xl px-2"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Formulaire modal ou Tableau de visualisation */}
        {isEditing ? (
          <form onSubmit={handleSubmitForm} className="p-6 space-y-4 overflow-y-auto">
            <h3 className="text-sm font-bold text-slate-800">
              {editingId ? "Modifier un créneau type" : "Ajouter un créneau type"}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Libellé du créneau
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Service Soir - Cuisine"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Semaine de la quinzaine
                </label>
                <select
                  value={formData.weekNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, weekNumber: Number(e.target.value) })
                  }
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500"
                >
                  <option value={1}>Semaine 1 (Jours 1 à 7)</option>
                  <option value={2}>Semaine 2 (Jours 8 à 14)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jour de la semaine
                </label>
                <select
                  value={formData.dayOfWeek}
                  onChange={(e) =>
                    setFormData({ ...formData, dayOfWeek: Number(e.target.value) })
                  }
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500"
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Rôle ciblé
                </label>
                <select
                  value={formData.roleTarget}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      roleTarget: e.target.value as "SALARIE" | "MANAGER" | "SUPER_ADMIN",
                    })
                  }
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500"
                >
                  <option value="SALARIE">Salarié HCR</option>
                  <option value="MANAGER">Manager</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Heure de début (HH:mm)
                </label>
                <input
                  type="time"
                  required
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Heure de fin (HH:mm)
                </label>
                <input
                  type="time"
                  required
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="isActive" className="text-xs font-medium text-slate-700">
                Créneau type actif (inclus lors de la duplication de la quinzaine)
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditing(false)}
                disabled={isPending}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                {isPending ? "Enregistrement..." : "Enregistrer le créneau"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="p-6 flex-1 flex flex-col overflow-hidden">
            {/* Toolbar interne */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div className="flex border border-slate-200 rounded-lg p-1 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setActiveWeek(1)}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                    activeWeek === 1
                      ? "bg-white text-blue-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Semaine 1 (Jours 1-7)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveWeek(2)}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                    activeWeek === 2
                      ? "bg-white text-blue-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Semaine 2 (Jours 8-14)
                </button>
              </div>

              <Button
                size="sm"
                onClick={handleStartCreate}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
              >
                + Ajouter un créneau type
              </Button>
            </div>

            {/* Tableau synthétique */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg">
              {isLoading ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Chargement des créneaux types...
                </div>
              ) : currentWeekTemplates.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Aucun créneau type configuré pour la Semaine {activeWeek}. Cliquez sur « + Ajouter un créneau type ».
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 sticky top-0">
                    <tr>
                      <th className="p-3 font-semibold">Jour</th>
                      <th className="p-3 font-semibold">Libellé</th>
                      <th className="p-3 font-semibold">Horaires</th>
                      <th className="p-3 font-semibold">Rôle Ciblé</th>
                      <th className="p-3 font-semibold">Statut</th>
                      <th className="p-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {currentWeekTemplates.map((item) => {
                      const dayName =
                        DAYS_OF_WEEK.find((d) => d.id === item.dayOfWeek)?.label ??
                        `Jour ${item.dayOfWeek}`;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-bold text-slate-900">{dayName}</td>
                          <td className="p-3 font-medium text-slate-800">{item.name}</td>
                          <td className="p-3 text-slate-700 font-semibold">
                            {item.startTime} - {item.endTime}
                          </td>
                          <td className="p-3 text-slate-600">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[11px] font-semibold">
                              {item.roleTarget}
                            </span>
                          </td>
                          <td className="p-3">
                            {item.isActive ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                Actif
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                                Inactif
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right whitespace-nowrap">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStartEdit(item)}
                                className="text-xs h-7 px-2"
                              >
                                Modifier
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDelete(item.id)}
                                disabled={isPending}
                                className="text-xs h-7 px-2 text-rose-600 hover:bg-rose-50 border-rose-200"
                              >
                                Supprimer
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 mt-4">
              <Button variant="outline" onClick={onClose}>
                Fermer
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
