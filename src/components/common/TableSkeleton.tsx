import { Skeleton } from "@/components/ui/skeleton";

// A generic placeholder for a table's first load — shape only, no column
// labels, since callers differ too much on columns to make a labeled
// version worth the extra props.
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}
