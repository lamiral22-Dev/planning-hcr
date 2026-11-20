"use client";

import { Button } from "@/components/ui/button";

export default function PlanningRestaurantError({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-white p-8 text-center">
      <h2 className="text-lg font-bold text-red-900">Impossible de charger le planning restaurant.</h2>
      <p className="mt-2 text-sm text-slate-600">Réessayez. Si le problème persiste, contactez votre administrateur.</p>
      <Button className="mt-4" onClick={reset}>Réessayer</Button>
    </div>
  );
}
