import { Banner } from "@/components/common/Banner";
import { Button } from "@/components/ui/button";
import type { DuplicateConflict } from "@/lib/api/tracking";

export function DuplicateWarning({
  conflict,
  onOpen,
  onForce,
  busy,
}: {
  conflict: DuplicateConflict;
  onOpen: (id: number) => void;
  onForce: () => void;
  busy: boolean;
}) {
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
                Open
              </Button>
            </li>
          ))}
        </ul>
        <Button size="sm" variant="secondary" disabled={busy} onClick={onForce}>
          {busy ? "Creating…" : "Create anyway"}
        </Button>
      </div>
    </Banner>
  );
}
