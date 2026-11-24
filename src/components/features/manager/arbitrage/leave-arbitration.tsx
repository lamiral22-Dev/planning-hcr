"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toAppTime } from "@/lib/time-utils";
import { reviewLeaveRequest } from "@/actions/leave-actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

type Leave = { id: string; type: string; employee: string; startDate: string; endDate: string; reason: string | null };
type Conflict = { id: string; startTime: Date; endTime: Date; status: string; planningVersion: number };

function leaveTypeLabel(type: string) {
  return type === "AUTRE_MOTIF" ? "CP autre motif" : type;
}

export function LeaveArbitration({ leaves }: { leaves: Leave[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [comments, setComments] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState<{ leave: Leave; shifts: Conflict[] } | null>(null);
  const [feedback, setFeedback] = useState("");

  const review = (leave: Leave, approved: boolean, forceReleaseShifts = false) => {
    startTransition(async () => {
      const result = await reviewLeaveRequest({ id: leave.id, approved, forceReleaseShifts, comment: comments[leave.id],
        confirmedShifts: forceReleaseShifts ? conflict?.shifts.map(({ id, planningVersion }) => ({ id, planningVersion })) : undefined });
      if (!result.success) { setFeedback(result.error); return; }
      if (result.data.conflicts.length) {
        setConflict({ leave, shifts: result.data.conflicts });
      } else {
        setConflict(null);
        setFeedback(approved ? "Demande validée." : "Demande refusée.");
        router.refresh();
      }
    });
  };
  return <section className="space-y-3 rounded-xl border bg-white p-4">
    <h2 className="text-lg font-bold">Demandes de Congés à valider</h2>
    {feedback && <p role="status">{feedback}</p>}
    {!leaves.length && <p className="text-sm text-slate-500">Aucune demande en attente.</p>}
    {leaves.map((leave) => <div key={leave.id} className="space-y-2 border-t pt-3">
      <p className="font-semibold">{leave.employee} · {leaveTypeLabel(leave.type)} · {leave.startDate} au {leave.endDate}</p>
      {leave.reason && <p className="text-sm">{leave.reason}</p>}
      <label className="block text-sm">Commentaire
        <input value={comments[leave.id] ?? ""} onChange={(event) => setComments({ ...comments, [leave.id]: event.target.value })} maxLength={1000} className="ml-2 rounded border p-2" />
      </label>
      <div className="flex gap-2">      <Button disabled={pending} onClick={() => review(leave, true)}>Approuver</Button>
        <Button variant="outline" disabled={pending} onClick={() => review(leave, false)}>Refuser</Button></div>
    </div>)}
    <Dialog isOpen={Boolean(conflict)} onClose={() => setConflict(null)} title="Conflit avec des shifts planifiés">
      {conflict && <div className="space-y-3">
        <p>Les créneaux ci-dessous seront annulés et libérés immédiatement lors de la validation, sans dérogation liée au délai de prévenance.</p>
        <ul className="list-disc pl-5">{conflict.shifts.map((shift) => <li key={shift.id}>
          {format(toAppTime(new Date(shift.startTime)), "dd/MM/yyyy HH:mm")} – {format(toAppTime(new Date(shift.endTime)), "dd/MM/yyyy HH:mm")} ({shift.status})
        </li>)}</ul>
        {feedback && <p role="alert">{feedback}</p>}
        <div className="flex flex-wrap gap-2">
          <Button disabled={pending} onClick={() => review(conflict.leave, true, true)}>Valider le {leaveTypeLabel(conflict.leave.type)} et libérer les créneaux</Button>
          <Button variant="outline" disabled={pending} onClick={() => review(conflict.leave, false)}>Refuser le {leaveTypeLabel(conflict.leave.type)} et maintenir les shifts</Button>
        </div>
      </div>}
    </Dialog>
  </section>;
}
