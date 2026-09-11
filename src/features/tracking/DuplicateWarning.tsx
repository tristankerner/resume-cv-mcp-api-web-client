import { Banner } from "@/components/common/Banner";
import { Button } from "@/components/ui/button";
import type { DuplicateConflict } from "@/lib/api/tracking";

export function DuplicateWarning({
  conflict,
  onOpen,
  openLabel = "Open",
  onForce,
  forceLabel = "Create anyway",
  // An exact normalized-name match is refused unconditionally server-side for
  // companies and company stack items — the unique index rejects it whatever
  // confirm_create_duplicate says — so offering an override there would be a
  // button that cannot succeed. Applications and contacts have no such rule
  // and must keep the override even on an exact match, which for a shared job
  // code is *every* match. Opt in; do not infer from the payload.
  exactIsFinal = false,
  busy,
}: {
  conflict: DuplicateConflict;
  onOpen: (id: number) => void;
  openLabel?: string;
  onForce: () => void;
  forceLabel?: string;
  exactIsFinal?: boolean;
  busy: boolean;
}) {
  const canForce = !exactIsFinal || !conflict.candidates.some((c) => c.match === "exact");
  const busyLabel = forceLabel === "Create anyway" ? "Creating…" : "Saving…";

  return (
    <Banner kind="warn">
      <div className="space-y-3">
        <p>{conflict.message}</p>
        <ul className="space-y-1">
          {conflict.candidates.map((candidate) => (
            <li key={candidate.id} className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{candidate.label}</span>
              <span className="text-xs text-muted-foreground">
                {candidate.match} match, {Math.round(candidate.score * 100)}%
                {candidate.hint ? ` — ${candidate.hint}` : ""}
              </span>
              <Button size="sm" variant="outline" onClick={() => onOpen(candidate.id)}>
                {openLabel}
              </Button>
            </li>
          ))}
        </ul>
        {canForce && (
          <Button size="sm" variant="secondary" disabled={busy} onClick={onForce}>
            {busy ? busyLabel : forceLabel}
          </Button>
        )}
      </div>
    </Banner>
  );
}
