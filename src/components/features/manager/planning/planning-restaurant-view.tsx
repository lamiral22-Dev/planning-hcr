"use client";

import { useMemo, useState, useTransition } from "react";
import {
  addDays,
  addWeeks,
  endOfMonth,
  format,
  getISOWeek,
  parse,
  startOfWeek,
} from "date-fns";
import { fr } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { archiveRestaurantSlot, assignRestaurantSlot, duplicateRestaurantWeek, saveRestaurantSlot, toggleRestaurantClosure } from "@/actions/restaurant-planning-actions";
import { deleteShift, publishQuinzaine, updateShift } from "@/actions/shift-actions";
import { calculateWeeklyHours, dailyRestViolationShiftIds } from "@/lib/hcr-rules";
import { calculateRestaurantRecap } from "@/lib/restaurant-recap";
import { shiftDatesForDay, toAppTime, fromAppTime } from "@/lib/time-utils";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

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
  weekStart: string;
  employees: RestaurantEmployee[];
  slots: RestaurantSlot[];
  shifts: RestaurantShift[];
  closures: RestaurantClosure[];
  leaves?: { id: string; userId: string; name: string; type: string; startDate: string; endDate: string }[];
}

function dateKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function CellAlert({ label }: { label: string }) {
  return <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">{label}</span>;
}

export function PlanningRestaurantView({ weekStart, employees, slots, shifts, closures, leaves = [] }: Props) {
  const router = useRouter();
  const center = useMemo(() => parse(weekStart, "yyyy-MM-dd", new Date()), [weekStart]);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [editingSlot, setEditingSlot] = useState<RestaurantSlot | null>(null);
  const [editingShift, setEditingShift] = useState<RestaurantShift | null>(null);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [duplicateStart, setDuplicateStart] = useState(() => format(toAppTime(new Date()), "yyyy-MM-dd"));
  const [duplicateEnd, setDuplicateEnd] = useState(() => format(endOfMonth(toAppTime(new Date())), "yyyy-MM-dd"));
  const [sourceWeek, setSourceWeek] = useState(weekStart);
  const [leaveConflict, setLeaveConflict] = useState<{ slot: RestaurantSlot; day: Date; employeeId: string } | null>(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(center, index)), [center]);
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
  const dailyRestViolations = useMemo(() => {
    const result = new Set<string>();
    for (const employeeShifts of shiftsByEmployee.values()) {
      for (const id of dailyRestViolationShiftIds(employeeShifts.map((shift) => ({
        id: shift.id, startTime: new Date(shift.startTime), endTime: new Date(shift.endTime),
      })))) result.add(id);
    }
    return result;
  }, [shiftsByEmployee]);
  const recaps = useMemo(() => {
    const result = new Map<string, { weeklyHours: number; monthlyHours: number }>();
    for (const employee of employees) {
      const employeeShifts = (shiftsByEmployee.get(employee.id) ?? [])
        .map((shift) => ({ startTime: new Date(shift.startTime), endTime: new Date(shift.endTime) }));
      result.set(employee.id, calculateRestaurantRecap(employeeShifts, fromAppTime(center)));
    }
    return result;
  }, [center, employees, shiftsByEmployee]);

  const navigateWeek = (week: Date) => {
    router.push(`/manager/planning?week=${dateKey(week)}`);
  };

  const refresh = (message?: string) => {
    if (message) setFeedback(message);
    setSelectedEmployee(null);
    router.refresh();
  };

  const assign = (slot: RestaurantSlot, day: Date, employeeId: string, forceOverrideLeave = false) => {
    const times = shiftDatesForDay(dateKey(day), slot.startTime, slot.endTime);
    const first = dateKey(toAppTime(times.startTime));
    const last = dateKey(toAppTime(new Date(times.endTime.getTime() - 1)));
    if (!forceOverrideLeave && leaves.some((leave) => leave.userId === employeeId && leave.startDate <= last && leave.endDate >= first)) {
      setLeaveConflict({ slot, day, employeeId });
      return;
    }
    startTransition(async () => {
      const result = await assignRestaurantSlot({ slotId: slot.id, userId: employeeId, date: dateKey(day), forceOverrideLeave });
      if (!result.success) {
        setFeedback(result.error);
        if (result.code === "LEAVE_CONFLICT") setLeaveConflict({ slot, day, employeeId });
      }
      else if ("pending" in result.data && result.data.pending) setFeedback("Remplacement tardif soumis à l'accord du salarié actuellement affecté.");
      else setFeedback("Affectation enregistrée.");
      if (result.success) setLeaveConflict(null);
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
      if (result.success) setDuplicateOpen(false);
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
          <Button variant="outline" onClick={() => navigateWeek(startOfWeek(toAppTime(new Date()), { weekStartsOn: 1 }))}>Aujourd&apos;hui</Button>
          <Button variant="outline" onClick={() => navigateWeek(addWeeks(center, -1))}>← Semaine précédente</Button>
          <span className="text-sm font-semibold">Semaine {getISOWeek(center)} ({format(center, "d MMM", { locale: fr })} - {format(addDays(center, 6), "d MMM", { locale: fr })})</span>
          <Button variant="outline" onClick={() => navigateWeek(addWeeks(center, 1))}>Semaine suivante →</Button>
          <Button onClick={() => { setSourceWeek(weekStart); setDuplicateOpen(true); }}>Dupliquer sur une période</Button>
        </div>
      </header>

      {feedback && <div role="status" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">{feedback}</div>}
      {employees.length === 0 && <div className="rounded-lg border bg-white p-6 text-slate-600">Aucun salarié actif à affecter.</div>}
      {slots.length === 0 && <div className="rounded-lg border border-dashed bg-white p-6 text-slate-600">Aucune ligne de créneau configurée. Utilisez « + Ajouter une ligne de créneau » pour commencer.</div>}

      <div className="rounded-lg border bg-white shadow-sm">
        <table className="w-full table-fixed border-collapse text-xs">
          <colgroup>
            <col className="w-16 sm:w-24" />
            <col className="w-24 sm:w-32" />
            {days.map((day) => <col key={dateKey(day)} />)}
          </colgroup>
          <thead className="sticky top-0 z-20 bg-slate-50">
            <tr>
              <th className="border p-1 text-center" rowSpan={2}>Shift</th>
              <th className="border p-1 text-center" rowSpan={2}>Poste · horaire fixe</th>
                <th className="border bg-slate-100 p-1" colSpan={7}>
                  <div className="flex items-center justify-center gap-3">
                    <span className="font-bold">S{String(getISOWeek(center)).padStart(2, "0")}</span>
                    <Button disabled={pending} className="h-7 px-2 text-[10px]" onClick={() => publishWeek(center)}>Publier cette semaine</Button>
                  </div>
                </th>
            </tr>
            <tr>
              {days.map((day) => (
                <th key={dateKey(day)} className="border px-1 py-2 text-center">
                  <div>{format(day, "EEE", { locale: fr })}</div>
                  <div className="font-semibold">{format(day, "dd/MM")}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-blue-50">
              <th className="border bg-blue-50 p-1 text-center">Salariés</th>
              <td className="border bg-blue-50 p-1 text-center text-slate-500">Glisser ou sélectionner</td>
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
                <th className="border bg-white p-1 text-center font-bold text-slate-500">
                  Shift
                </th>
                <th className="border bg-white p-1 text-center break-words">
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
                  const dailyRestViolation = assigned && dailyRestViolations.has(assigned.id);
                  return (
                    <td
                      key={`${slot.id}:${key}`}
                      className={`border p-1 text-center break-words ${closed ? "bg-slate-100" : selectedEmployee && !assigned ? "bg-blue-50" : ""}`}
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
              <th colSpan={2} className="border bg-emerald-50 p-2">Absences / Congés validés</th>
              {days.map((day) => <td key={dateKey(day)} className="border bg-emerald-50 p-1 align-top">
                {leaves.filter((leave) => leave.startDate <= dateKey(day) && leave.endDate >= dateKey(day)).map((leave) =>
                  <div key={leave.id} className="rounded bg-emerald-100 p-1 font-semibold text-emerald-900">{leave.type} · {leave.name}</div>
                )}
              </td>)}
            </tr>
            <tr>
              <td colSpan={2} className="border bg-white p-2">
                <Button variant="outline" className="h-auto w-full whitespace-normal" onClick={() => setEditingSlot({ id: "", name: "", startTime: "11:00", endTime: "15:00", closedDays: [] })}>+ Ajouter une ligne de créneau</Button>
              </td>
              <td colSpan={days.length} className="border bg-white" />
            </tr>
          </tbody>
        </table>
      </div>

      <Dialog isOpen={Boolean(leaveConflict)} onClose={() => setLeaveConflict(null)} title="Congé validé sur ce créneau">
        {leaveConflict && <div className="space-y-3">
          <p>Cette affectation modifiera le congé sur les jours concernés. Si elle est tardive, le congé reste actif jusqu&apos;à l&apos;accord du salarié.</p>
          {feedback && <p role="status">{feedback}</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setLeaveConflict(null)}>Maintenir le congé</Button>
            <Button disabled={pending} onClick={() => assign(leaveConflict.slot, leaveConflict.day, leaveConflict.employeeId, true)}>Affecter le shift (annuler le congé sur ce jour)</Button>
          </div>
        </div>}
      </Dialog>

      {shifts.filter((shift) => {
        const day = dateKey(toAppTime(new Date(shift.startTime)));
        return day >= weekStart && day <= dateKey(addDays(center, 6)) &&
          !slots.some((slot) => slot.id === shift.slotId);
      }).map((shift) => (
        <div key={shift.id} className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
          Shift sans créneau actif : {employeeById.get(shift.userId)?.name ?? "Salarié inactif"} ·{" "}
          {format(toAppTime(new Date(shift.startTime)), "dd/MM HH:mm")}–{format(toAppTime(new Date(shift.endTime)), "dd/MM HH:mm")}
          {" "}<button type="button" className="font-semibold underline" onClick={() => setEditingShift(shift)}>Modifier</button>
        </div>
      ))}

      <div className="rounded-lg border bg-white shadow-sm">
        <table className="w-full table-fixed border-collapse text-xs">
          <thead><tr className="bg-slate-100">
            <th className="border p-2 text-left">Récap salarié</th>
            <th className="border p-2">S{String(getISOWeek(center)).padStart(2, "0")} · Hebdo théo</th>
            <th className="border p-2">Mensuel théo</th>
          </tr></thead>
          <tbody>{employees.map((employee) => <tr key={employee.id}>
            <th className="border bg-white p-2 text-left">{employee.name}</th>
            <td className="border p-2 text-center">{recaps.get(employee.id)?.weeklyHours.toFixed(2)} h</td>
            <td className="border p-2 text-center">{recaps.get(employee.id)?.monthlyHours.toFixed(2)} h</td>
          </tr>)}</tbody>
        </table>
      </div>

      <Dialog isOpen={duplicateOpen} onClose={() => setDuplicateOpen(false)} title="Dupliquer sur une période">
        <form onSubmit={(event) => { event.preventDefault(); duplicate(); }} className="space-y-4">
          <label className="block text-sm" htmlFor="source-week">Semaine type à dupliquer
            <input id="source-week" type="date" required value={sourceWeek} onChange={(event) => setSourceWeek(event.target.value)} className="mt-1 w-full rounded border p-2" />
          </label>
          <label className="block text-sm" htmlFor="duplicate-start">Début de période
            <input id="duplicate-start" type="date" required value={duplicateStart} onChange={(event) => setDuplicateStart(event.target.value)} className="mt-1 w-full rounded border p-2" />
          </label>
          <label className="block text-sm" htmlFor="duplicate-end">Fin de période
            <input id="duplicate-end" type="date" required value={duplicateEnd} onChange={(event) => setDuplicateEnd(event.target.value)} className="mt-1 w-full rounded border p-2" />
          </label>
          {feedback && <p role="status" className="text-sm text-slate-700">{feedback}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDuplicateOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={pending}>Dupliquer</Button>
          </div>
        </form>
      </Dialog>

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
