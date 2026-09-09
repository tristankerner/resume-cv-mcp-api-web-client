import { useMemo, useState } from "react";

import { DateTimeText } from "@/components/common/DateTime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DiffTable } from "@/features/documents/DiffTable";
import { DocumentDiffView } from "@/features/documents/DocumentDiffView";
import type { DocumentRevision } from "@/lib/api/documents";
import type { JsonValue } from "@/lib/documents/diff";
import { diffDocuments } from "@/lib/documents/diff";

// A side of the comparison is either a saved revision or the working copy in
// the editor above — the one side that is not in `revisions`. The newest
// revision is the live document, so picking it covers "live vs older";
// "current" additionally covers unsaved edits and content pulled in by
// Restore, which exist nowhere on the server.
type CompareTarget = number | "current";

const CURRENT = "current" as const;

function targetLabel(target: CompareTarget | null): string {
  if (target === null) return "";
  return target === CURRENT ? "Current" : `#${target}`;
}

// Two independent radio groups, each scattered one input per table row
// (an L and an R column) rather than a single contiguous list — the shape
// shadcn's RadioGroup assumes. Radix's RadioGroup.Root requires every
// RadioGroupItem to be its descendant, which a per-row render can't satisfy
// without restructuring the table around two duplicate radio-group trees.
// Native radios with HTML's own name-based grouping are the better fit
// here; styled and labelled directly instead.
function CompareRadios({
  target,
  left,
  right,
  onLeft,
  onRight,
}: {
  target: CompareTarget;
  left: CompareTarget | null;
  right: CompareTarget | null;
  onLeft: (target: CompareTarget) => void;
  onRight: (target: CompareTarget) => void;
}) {
  const label = targetLabel(target);
  return (
    <>
      <label className="mr-3 inline-flex items-center gap-1 text-xs font-normal">
        <input
          type="radio"
          name="compare-left"
          className="size-4 accent-primary"
          aria-label={`Compare left: ${label}`}
          checked={left === target}
          onChange={() => onLeft(target)}
        />
        L
      </label>
      <label className="inline-flex items-center gap-1 text-xs font-normal">
        <input
          type="radio"
          name="compare-right"
          className="size-4 accent-primary"
          aria-label={`Compare right: ${label}`}
          checked={right === target}
          onChange={() => onRight(target)}
        />
        R
      </label>
    </>
  );
}

export function RevisionPanel({
  revisions,
  truncated,
  liveRevisionId,
  editorVersion,
  getEditorJson,
  onRestore,
}: {
  revisions: DocumentRevision[];
  truncated: boolean;
  liveRevisionId: number;
  // The editor is uncontrolled — its content lives inside the
  // vanilla-jsoneditor instance, not in React state — so `getEditorJson`
  // reads it imperatively and `editorVersion`, bumped by the parent on every
  // change, is what tells the diff below to read it again.
  editorVersion: number;
  getEditorJson: () => JsonValue | undefined;
  onRestore: (rev: DocumentRevision) => void;
}) {
  const [compareLeft, setCompareLeft] = useState<CompareTarget | null>(null);
  const [compareRight, setCompareRight] = useState<CompareTarget | null>(null);
  const [compareMode, setCompareMode] = useState<"changes" | "diff">("diff");

  const comparison = useMemo(() => {
    if (compareLeft === null || compareRight === null) return null;
    const dataFor = (target: CompareTarget) =>
      target === CURRENT
        ? getEditorJson()
        : revisions.find((r) => r.revision_id === target)?.data;
    const left = dataFor(compareLeft);
    const right = dataFor(compareRight);
    // Only "current" can come back undefined, and only while the editor
    // holds text that does not parse as JSON.
    if (left === undefined || right === undefined) return null;
    return { left, right, rows: diffDocuments(left, right) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareLeft, compareRight, revisions, editorVersion]);

  const bothPicked = compareLeft !== null && compareRight !== null;

  return (
    <Card className="mt-5">
      <CardHeader>
        <CardTitle>Revisions</CardTitle>
        <p className="text-sm text-muted-foreground">
          Pick a Left and a Right row to compare them. <strong>Current</strong> is the content in
          the editor above, so you can diff the live document — or unsaved edits to it — against
          any revision.
        </p>
        {truncated && (
          <p className="text-sm text-muted-foreground">
            Showing the 50 most recent revisions; older history is not reachable.
          </p>
        )}
      </CardHeader>
      <CardContent>
        <Table className="table-reflow">
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>Public</TableHead>
              <TableHead>Compare</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="bg-muted/40">
              <TableCell data-label="#" className="font-medium">
                Current
              </TableCell>
              <TableCell data-label="Created">—</TableCell>
              <TableCell data-label="Note" className="max-w-[40ch] truncate">
                The content in the editor above, including unsaved edits.
              </TableCell>
              <TableCell data-label="Public">—</TableCell>
              <TableCell data-label="Compare">
                <CompareRadios
                  target={CURRENT}
                  left={compareLeft}
                  right={compareRight}
                  onLeft={setCompareLeft}
                  onRight={setCompareRight}
                />
              </TableCell>
              <TableCell data-label=""></TableCell>
            </TableRow>
            {revisions.map((rev) => (
              <TableRow key={rev.revision_id}>
                <TableCell data-label="#">
                  #{rev.revision_id}
                  {rev.revision_id === liveRevisionId && (
                    <Badge variant="secondary" className="ml-2">
                      live
                    </Badge>
                  )}
                </TableCell>
                <TableCell data-label="Created"><DateTimeText value={rev.created_at} /></TableCell>
                <TableCell data-label="Note" className="max-w-[40ch] truncate" title={rev.revision_note || undefined}>
                  {rev.revision_note || "—"}
                </TableCell>
                <TableCell data-label="Public">{rev.public ? "Yes" : "No"}</TableCell>
                <TableCell data-label="Compare">
                  <CompareRadios
                    target={rev.revision_id}
                    left={compareLeft}
                    right={compareRight}
                    onLeft={setCompareLeft}
                    onRight={setCompareRight}
                  />
                </TableCell>
                <TableCell data-label="">
                  <Button size="sm" variant="outline" onClick={() => onRestore(rev)}>
                    Restore
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {bothPicked && comparison === null && (
          <p className="mt-4 text-sm text-muted-foreground">
            The editor does not currently hold valid JSON, so there is nothing to compare against.
          </p>
        )}

        {comparison !== null && (
          <div className="mt-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-medium">
                Comparing {targetLabel(compareLeft)} → {targetLabel(compareRight)}
              </h4>
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={compareMode}
                onValueChange={(v) => v && setCompareMode(v as "changes" | "diff")}
              >
                <ToggleGroupItem value="changes" aria-label="Changes mode">
                  Changes
                </ToggleGroupItem>
                <ToggleGroupItem value="diff" aria-label="Diff mode">
                  Diff
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            {compareMode === "changes" ? (
              <DiffTable rows={comparison.rows} />
            ) : (
              <DocumentDiffView
                left={comparison.left}
                right={comparison.right}
                leftLabel={targetLabel(compareLeft)}
                rightLabel={targetLabel(compareRight)}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
