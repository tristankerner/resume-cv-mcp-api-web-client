import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// A small local pair rather than a shadcn primitive — dl/dt/dd is already
// the semantically correct element for this, there is just no shared
// styling for it yet.
export function DetailList({ className, children }: { className?: string; children: ReactNode }) {
  return <dl className={cn("space-y-2 text-sm", className)}>{children}</dl>;
}

export function DetailRow({
  label,
  className,
  children,
}: {
  label: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={className}>{children}</dd>
    </div>
  );
}
