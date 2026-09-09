import type { ReactNode } from "react";

import { Empty, EmptyContent, EmptyDescription } from "@/components/ui/empty";

export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <Empty className="p-12">
      <EmptyDescription>{children}</EmptyDescription>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}
