"use client";

import { useMemo, useState, useTransition } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  format,
  getISOWeek,
  startOfWeek,
} from "date-fns";
import { fr } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { archiveRestaurantSlot, assignRestaurantSlot, duplicateRestaurantWeek, saveRestaurantSlot, toggleRestaurantClosure } from "@/actions/restaurant-planning-actions";
import { deleteShift, publishQuinzaine, updateShift } from "@/actions/shift-actions";
import { calculateWeeklyHours, checkDailyRest } from "@/lib/hcr-rules";
import { calculateRestaurantRecap } from "@/lib/restaurant-recap";
import { shiftDatesForDay, toAppTime, fromAppTime } from "@/lib/time-utils";
import { Button } from "@/components/ui/button";

export interface RestaurantEmployee {
  id: string;
  name: string;
}

export interface RestaurantSlot {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  closedDays: number[];
}

export interface RestaurantShift {
  id: string;
  slotId: string | null;
  userId: string;
  startTime: string;
  endTime: string;
  status: string;
  isLateModification: boolean;
  derogationAcceptedAt: string | null;
  pendingReplacements: { id: string; proposedUserName: string }[];
}

export interface RestaurantClosure {
  slotId: string;
  date: string;
  closed: boolean;
}

interface Props {
  employees: RestaurantEmployee[];
  slots: RestaurantSlot[];
  shifts: RestaurantShift[];
  closures: RestaurantClosure[];
}

function dateKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function CellAlert({ label }: { label: string }) {
  return <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">{label}</span>;
}

export function PlanningRestaurantView({ employees, slots, shifts, closures }: Props) {
  const router = useRouter();
  const [center, setCenter] = useState(() => startOfWeek(toAppTime(new Date()), { weekStartsOn: 1 }));
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [editingSlot, setEditingSlot] = useState<RestaurantSlot | null>(null);
  const [editingShift, setEditingShift] = useState<RestaurantShift | null>(null);
  const [duplicateStart, setDuplicateStart] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [duplicateEnd, setDuplicateEnd] = useState(() => format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [sourceWeek, setSourceWeek] = useState(() => format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));

  const weeks = useMemo(() =>
    Array.from({ length: 52 }, (_, index) => addWeeks(center, index - 25)),
  [center]);
  const days = useMemo(() => weeks.flatMap((week) =>
    Array.from({ length: 7 }, (_, index) => addDays(week, index))
  ), [weeks]);
  const employeeById = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);
  const closureOverrides = useMemo(() =>
    new Map(closures.map((closure) => [`${closure.slotId}:${closure.date}`, closure.closed])),
  [closures]);
  const shiftsByCell = useMemo(() => {
    const result = new Map<string, RestaurantShift[]>();
    for (const shift of shifts) {
      if (!shift.slotId) continue;
      const key = `${shift.slotId}:${dateKey(toAppTime(new Date(shift.startTime)))}`;
      result.set(key, [...(result.get(key) ?? []), shift]);
    }
    return result;
  }, [shifts]);
  const shiftsByEmployee = useMemo(() => {
    const result = new Map<string, RestaurantShift[]>();
    for (const shift of shifts) result.set(shift.userId, [...(result.get(shift.userId) ?? []), shift]);
    return result;
  }, [shifts]);
  const recaps = useMemo(() => {
    const result = new Map<string, Map<string, { weeklyHours: number; monthlyHours: number }>>();
    for (const week of weeks) {
      const byEmployee = new Map<string, { weeklyHours: number; monthlyHours: number }>();
      for (const employee of employees) {
        const employeeShifts = (shiftsByEmployee.get(employee.id) ?? [])
          .map((shift) => ({ startTime: new Date(shift.startTime), endTime: new Date(shift.endTime) }));
        byEmployee.set(employee.id, calculateRestaurantRecap(employeeShifts, week));
      }
      result.set(dateKey(week), byEmployee);
    }
    return result;
  }, [employees, shiftsByEmployee, weeks]);

  const refresh = (message?: string) => {
    if (message) setFeedback(message);
    setSelectedEmployee(null);
    router.refresh();
  };

  const assign = (slot: RestaurantSlot, day: Date, employeeId: string) => {
    startTransition(async () => {
      const result = await assignRestaurantSlot({ slotId: slot.id, userId: employeeId, date: dateKey(day) });
      if (!result.success) setFeedback(result.error);
      else if ("pending" in result.data && result.data.pending) setFeedback("Remplacement tardif soumis à l'accord du salarié actuellement affecté.");
      else setFeedback("Affectation enregistrée.");
      setSelectedEmployee(null);
      router.refresh();
    });
  };

  const toggleClosed = (slot: RestaurantSlot, day: Date) => {
    startTransition(async () => {
      const result = await toggleRestaurantClosure(slot.id, dateKey(day));
      setFeedback(result.success ? (result.data.closed ? "Case fermée." : "Case rouverte.") : result.error);
      router.refresh();
    });
  };

  const publishWeek = (week: Date) => {
    const start = fromAppTime(week);
    const end = new Date(fromAppTime(addDays(week, 7)).getTime() - 1);
    startTransition(async () => {
      const result = await publishQuinzaine(start, end);
      if (result.success && typeof result.data === "object" && result.data !== null &&
          "publishedCount" in result.data && "derogationCount" in result.data) {
        setFeedback(`Semaine publiée : ${result.data.publishedCount} shift(s), ${result.data.derogationCount} accord(s) requis.`);
      } else setFeedback(result.success ? "Semaine publiée." : result.error);
      router.refresh();
    });
  };

  const saveSlot = (formData: FormData) => {
    const selectedDays = formData.getAll("closedDays").map(Number);
    startTransition(async () => {
      const result = await saveRestaurantSlot({
        id: editingSlot?.id || undefined,
        name: formData.get("name"),
        startTime: formData.get("startTime"),
        endTime: formData.get("endTime"),
        closedDays: selectedDays,
        isActive: true,
      });
      if (result.success) {
        setEditingSlot(null);
        refresh("Ligne de créneau enregistrée.");
      } else setFeedback(result.error);
    });
  };

  const duplicate = () => {
    startTransition(async () => {
      const result = await duplicateRestaurantWeek(sourceWeek, duplicateStart, duplicateEnd);
      setFeedback(result.success
        ? `Duplication terminée : ${result.data.createdCount} affectation(s) créée(s), ${result.data.skippedCount} ignorée(s).`
        : result.error);
      router.refresh();
    });
  };

  const updateExceptionalHours = (formData: FormData) => {
    if (!editingShift) return;
    const shiftDate = toAppTime(new Date(editingShift.startTime));
    const times = shiftDatesForDay(
      dateKey(shiftDate),
      String(formData.get("startTime")),
      String(formData.get("endTime")),
    );
    startTransition(async () => {
      const result = await updateShift(editingShift.id, {
        startTime: times.startTime,
        endTime: times.endTime,
        userId: editingShift.userId,
        slotId: editingShift.slotId,
      });
      if (result.success) {
        setEditingShift(null);
        refresh("Horaire exceptionnel enregistré.");
      } else setFeedback(result.error);
    });
  };

  const removeShift = () => {
    if (!editingShift) return;
    startTransition(async () => {
      const result = await deleteShift(editingShift.id);
      if (result.success) {
        setEditingShift(null);
        refresh("Shift supprimé.");
      } else setFeedback(result.error);
    });
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black tracking-tight text-slate-900">Planning Restaurant</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setCenter(startOfWeek(toAppTime(new Date()), { weekStartsOn: 1 }))}>Aujourd&apos;hui</Button>
          <Button variant="outline" aria-label="Mois précédent" onClick={() => setCenter(startOfWeek(addMonths(center, -1), { weekStartsOn: 1 }))}>←</Button>
          <input
            aria-label="Mois et année"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            type="month"
            value={format(center, "yyyy-MM")}
            onChange={(event) => {
              const next = new Date(`${event.target.value}-15T12:00:00`);
              if (!Number.isNaN(next.getTime())) setCenter(startOfWeek(next, { weekStartsOn: 1 }));
            }}
          />
          <Button variant="outline" aria-label="Mois suivant" onClick={() => setCenter(startOfWeek(addMonths(center, 1), { weekStartsOn: 1 }))}>→</Button>
          <Button variant="outline" onClick={() => setEditingSlot({ id: "", name: "", startTime: "08:00", endTime: "11:00", closedDays: [] })}>Gérer le planning type</Button>
          <div className="flex flex-wrap items-center gap-1 rounded-md border bg-white p-1">
            <label className="sr-only" htmlFor="source-week">Semaine type à dupliquer</label>
            <input id="source-week" aria-label="Semaine type à dupliquer" type="date" value={sourceWeek} onChange={(event) => setSourceWeek(event.target.value)} className="min-w-32 rounded px-2 py-1 text-xs" />
            <label className="sr-only" htmlFor="duplicate-start">Début de période</label>
            <input id="duplicate-start" type="date" value={duplicateStart} onChange={(event) => setDuplicateStart(event.target.value)} className="min-w-32 rounded px-2 py-1 text-xs" />
            <label className="sr-only" htmlFor="duplicate-end">Fin de période</label>
            <input id="duplicate-end" type="date" value={duplicateEnd} onChange={(event) => setDuplicateEnd(event.target.value)} className="min-w-32 rounded px-2 py-1 text-xs" />
            <Button disabled={pending} onClick={duplicate}>Dupliquer sur une période</Button>
          </div>
        </div>
      </header>

      {feedback && <div role="status" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">{feedback}</div>}
      {employees.length === 0 && <div className="rounded-lg border bg-white p-6 text-slate-600">Aucun salarié actif à affecter.</div>}
      {slots.length === 0 && <div className="rounded-lg border border-dashed bg-white p-6 text-slate-600">Aucune ligne de créneau configurée. Utilisez « Gérer le planning type » ou « + Ajouter une ligne de créneau » pour commencer.</div>}

      <div className="overflow-auto rounded-lg border bg-white shadow-sm">
        <table className="border-collapse text-xs" style={{ tableLayout: "fixed", width: `${400 + days.length * 112}px` }}>
          <colgroup>
            <col style={{ width: 220 }} />
            <col style={{ width: 180 }} />
            {days.map((day) => <col key={dateKey(day)} style={{ width: 112 }} />)}
          </colgroup>
          <thead className="sticky top-0 z-20 bg-slate-50">
            <tr>
              <th className="sticky left-0 z-30 border p-2 text-left" rowSpan={2}>Liste salarié / Shift</th>
              <th className="sticky left-[220px] z-30 border p-2 text-left" rowSpan={2}>Poste · horaire fixe</th>
              {weeks.map((week) => (
                <th key={dateKey(week)} className="border bg-slate-100 p-1" colSpan={7}>
                  <div className="flex items-center justify-center gap-3">
                    <span className="font-bold">S{String(getISOWeek(week)).padStart(2, "0")}</span>
                    <Button disabled={pending} className="h-7 px-2 text-[10px]" onClick={() => publishWeek(week)}>Publier cette semaine</Button>
                  </div>
                </th>
              ))}
            </tr>
            <tr>
              {days.map((day) => (
                <th key={dateKey(day)} className="border px-1 py-2 text-center">
                  <div>{format(day, "EEEE", { locale: fr })}</div>
                  <div className="font-semibold">{format(day, "dd/MM/yyyy")}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-blue-50">
              <th className="sticky left-0 z-10 border bg-blue-50 p-2 text-left">Liste salarié</th>
              <td className="sticky left-[220px] z-10 border bg-blue-50 p-2 text-slate-500">Glisser ou sélectionner</td>
              <td colSpan={days.length} className="border p-2">
                <div className="flex min-w-0 flex-wrap gap-2">
                  {employees.map((employee) => (
                    <button
                      key={employee.id}
                      type="button"
                      draggable
                      onDragStart={(event) => event.dataTransfer.setData("text/plain", employee.id)}
                      onClick={() => setSelectedEmployee((current) => current === employee.id ? null : employee.id)}
                      className={`min-h-10 rounded-full border px-3 font-semibold ${selectedEmployee === employee.id ? "border-blue-700 bg-blue-700 text-white" : "border-blue-200 bg-white text-blue-900"}`}
                    >
                      {employee.name}
                    </button>
                  ))}
                </div>
              </td>
            </tr>
            {slots.map((slot) => (
              <tr key={slot.id} className="h-16">
                <th className="sticky left-0 z-10 border bg-white p-2 text-left font-bold text-slate-500 [writing-mode:vertical-rl] rotate-180">
                  Shift
                </th>
                <th className="sticky left-[220px] z-10 border bg-white px-3 py-2 text-left">
                  <div className="font-bold text-slate-900">{slot.name}</div>
                  <div className="text-slate-500">{slot.startTime}–{slot.endTime}</div>
                  <button type="button" className="mt-1 text-[10px] font-medium text-blue-700 underline" onClick={() => setEditingSlot(slot)}>Modifier le poste</button>
                </th>
                {days.map((day) => {
                  const key = dateKey(day);
                  const weekday = ((day.getDay() + 6) % 7) + 1;
                  const closureOverride = closureOverrides.get(`${slot.id}:${key}`);
                  const closed = closureOverride ?? slot.closedDays.includes(weekday);
                  const assigned = shiftsByCell.get(`${slot.id}:${key}`)?.[0];
                  const employee = assigned ? employeeById.get(assigned.userId) : null;
                  const other = assigned ? (shiftsByEmployee.get(assigned.userId) ?? []).filter((shift) =>
                    shift.id !== assigned.id && shift.status !== "ANNULE"
                  ) : [];
                  const weeklyHours = assigned ? calculateWeeklyHours([
                    ...other.map((shift) => ({ startTime: new Date(shift.startTime), endTime: new Date(shift.endTime) })),
                    { startTime: new Date(assigned.startTime), endTime: new Date(assigned.endTime) },
                  ], new Date(assigned.startTime)) : 0;
                  const dailyRestViolation = assigned && other.some((shift) => {
                    const candidateStart = new Date(assigned.startTime);
                    const candidateEnd = new Date(assigned.endTime);
                    const priorStart = new Date(shift.startTime);
                    const priorEnd = new Date(shift.endTime);
                    if (priorEnd <= candidateStart) return !checkDailyRest(priorEnd, candidateStart);
                    if (candidateEnd <= priorStart) return !checkDailyRest(candidateEnd, priorStart);
                    return false;
                  });
                  return (
                    <td
                      key={`${slot.id}:${key}`}
                      className={`border p-1 text-center ${closed ? "bg-slate-100" : selectedEmployee && !assigned ? "bg-blue-50" : ""}`}
                      onDragOver={(event) => { if (!closed) event.preventDefault(); }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const employeeId = event.dataTransfer.getData("text/plain");
                        if (!closed && employeeId) assign(slot, day, employeeId);
                      }}
                      onClick={() => {
                        if (selectedEmployee && !closed) assign(slot, day, selectedEmployee);
                        else if (assigned) setEditingShift(assigned);
                        else if (!selectedEmployee) toggleClosed(slot, day);
                      }}
                    >
                      {closed
                        ? <button type="button" aria-label={`Rouvrir ${slot.name} le ${format(day, "dd/MM")}`} onClick={(event) => { event.stopPropagation(); toggleClosed(slot, day); }} className="text-xl font-black text-slate-400">X</button>
                        : assigned
                          ? <div className="flex cursor-pointer flex-col items-center gap-1">
                              <span className="font-bold text-slate-900">{employee?.name ?? "Salarié inactif"}</span>
                              <span className="text-[10px] text-slate-500">{format(toAppTime(new Date(assigned.startTime)), "HH:mm")}–{format(toAppTime(new Date(assigned.endTime)), "HH:mm")}</span>
                              <span className="flex flex-wrap justify-center gap-1">
                                {((assigned.isLateModification && !assigned.derogationAcceptedAt) || assigned.pendingReplacements.length > 0) && <CellAlert label={`Dérog. J < 8${assigned.pendingReplacements.length ? " · accord salarié requis" : ""}`} />}
                                {dailyRestViolation && <CellAlert label="Repos < 11h" />}
                                {weeklyHours > 48 && <CellAlert label="> 48h/sem" />}
                              </span>
                            </div>
                          : <button type="button" aria-label={`Affecter ou fermer ${slot.name} le ${format(day, "dd/MM")}`} className="min-h-12 w-full text-slate-300">{selectedEmployee ? "Affecter" : "＋ / X"}</button>}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td colSpan={2} className="sticky left-0 z-10 border bg-white p-2">
                <Button variant="outline" onClick={() => setEditingSlot({ id: "", name: "", startTime: "11:00", endTime: "15:00", closedDays: [] })}>+ Ajouter une ligne de créneau</Button>
              </td>
              <td colSpan={days.length} className="border bg-white" />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="overflow-auto rounded-lg border bg-white shadow-sm">
        <table className="border-collapse text-xs" style={{ tableLayout: "fixed", width: `${400 + weeks.length * 784}px` }}>
          <colgroup>
            <col style={{ width: 220 }} />
            <col style={{ width: 180 }} />
            {weeks.map((week) => <col key={dateKey(week)} style={{ width: 784 }} />)}
          </colgroup>
          <thead><tr className="bg-slate-100">
            <th className="sticky left-0 z-10 border p-2 text-left">Récap salarié</th>
            <th className="sticky left-[220px] z-10 border p-2">Hebdo théo · Mensuel théo</th>
            {weeks.map((week) => <th key={dateKey(week)} className="border p-2">Récap : S{String(getISOWeek(week)).padStart(2, "0")} · Hebdo théo · Mensuel théo</th>)}
          </tr></thead>
          <tbody>{employees.map((employee) => <tr key={employee.id}>
            <th className="sticky left-0 z-10 border bg-white p-2 text-left">{employee.name}</th>
            <td className="sticky left-[220px] z-10 border bg-white p-2 text-center">heures</td>
            {weeks.map((week) => {
              const recap = recaps.get(dateKey(week))?.get(employee.id);
              return <td key={dateKey(week)} className="border p-2 text-center">
                {recap?.weeklyHours.toFixed(2)} h · {recap?.monthlyHours.toFixed(2)} h
              </td>;
            })}
          </tr>)}</tbody>
        </table>
      </div>

      {editingSlot && (
        <div role="dialog" aria-modal="true" aria-labelledby="slot-dialog-title" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <form action={saveSlot} className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl">
            <h2 id="slot-dialog-title" className="text-lg font-bold">{editingSlot.id ? "Modifier le poste" : "Ajouter un poste"}</h2>
            <label className="block text-sm">Nom du poste<input name="name" required maxLength={80} defaultValue={editingSlot.name} className="mt-1 w-full rounded border p-2" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">Début<input name="startTime" type="time" required defaultValue={editingSlot.startTime} className="mt-1 w-full rounded border p-2" /></label>
              <label className="text-sm">Fin<input name="endTime" type="time" required defaultValue={editingSlot.endTime} className="mt-1 w-full rounded border p-2" /></label>
            </div>
            <fieldset><legend className="text-sm font-semibold">Jours fermés chaque semaine</legend>
              <div className="mt-2 flex flex-wrap gap-3">{["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day, index) =>
                <label key={day} className="flex items-center gap-1 text-sm"><input type="checkbox" name="closedDays" value={index + 1} defaultChecked={editingSlot.closedDays.includes(index + 1)} />{day}</label>
              )}</div>
            </fieldset>
            <div className="flex justify-between gap-2">
              {editingSlot.id && <Button type="button" variant="outline" disabled={pending} onClick={() => startTransition(async () => {
                const result = await archiveRestaurantSlot(editingSlot.id);
                if (result.success) { setEditingSlot(null); refresh("Poste archivé."); } else setFeedback(result.error);
              })}>Archiver</Button>}
              <span className="flex-1" />
              <Button type="button" variant="outline" onClick={() => setEditingSlot(null)}>Annuler</Button>
              <Button type="submit" disabled={pending}>Enregistrer</Button>
            </div>
          </form>
        </div>
      )}

      {editingShift && (
        <div role="dialog" aria-modal="true" aria-labelledby="shift-dialog-title" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <form action={updateExceptionalHours} className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl">
            <h2 id="shift-dialog-title" className="text-lg font-bold">Modifier le shift</h2>
            <p className="text-sm text-slate-600">L&apos;affectation est contrôlée selon les règles HCR et chaque modification est auditée.</p>
            <label className="block text-sm">Début exceptionnel<input name="startTime" type="time" required defaultValue={format(toAppTime(new Date(editingShift.startTime)), "HH:mm")} className="mt-1 w-full rounded border p-2" /></label>
            <label className="block text-sm">Fin exceptionnelle<input name="endTime" type="time" required defaultValue={format(toAppTime(new Date(editingShift.endTime)), "HH:mm")} className="mt-1 w-full rounded border p-2" /></label>
            <div className="flex flex-wrap justify-between gap-2">
              <Button type="button" variant="outline" disabled={pending} onClick={removeShift}>Vider la case / supprimer le shift</Button>
              <Button type="button" variant="outline" onClick={() => setEditingShift(null)}>Fermer</Button>
              <Button type="submit" disabled={pending}>Enregistrer</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
