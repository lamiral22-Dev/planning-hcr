import { Skeleton } from "@/components/ui/skeleton";

export default function PlanningRestaurantLoading() {
  return (
    <div className="space-y-4" aria-label="Chargement du planning restaurant">
      <Skeleton className="h-14 w-full rounded-lg" />
      <Skeleton className="h-28 w-full rounded-lg" />
      <Skeleton className="h-96 w-full rounded-lg" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}
