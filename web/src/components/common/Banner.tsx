import type { ReactNode } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export type BannerKind = "error" | "info" | "success" | "warn";

const VARIANT: Record<BannerKind, "default" | "destructive" | "success" | "warning"> = {
  error: "destructive",
  info: "default",
  success: "success",
  warn: "warning",
};

export function Banner({
  kind,
  children,
  onDismiss,
}: {
  kind: BannerKind;
  children: ReactNode;
  onDismiss?: () => void;
}) {
  if (!children) return null;
  return (
    <Alert variant={VARIANT[kind]} className="mb-4">
      <AlertDescription className="flex w-full items-start justify-between gap-3">
        <span>{children}</span>
        {onDismiss && (
          <Button type="button" variant="ghost" size="sm" className="h-auto shrink-0 p-1 -m-1" onClick={onDismiss}>
            Dismiss
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
