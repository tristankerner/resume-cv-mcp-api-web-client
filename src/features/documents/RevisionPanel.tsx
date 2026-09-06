import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DiffTable } from "@/features/documents/DiffTable";
import type { DocumentRevision } from "@/lib/api/documents";
import { diffDocuments, prettyJson } from "@/lib/documents/diff";

export function RevisionPanel({
  revisions,
  truncated,
  onRestore,
}: {
  revisions: DocumentRevision[];
  truncated: boolean;
  onRestore: (rev: DocumentRevision) => void;
}) {
  const [compareLeft, setCompareLeft] = useState<number | null>(null);
  const [compareRight, setCompareRight] = useState<number | null>(null);

  const diffRows = useMemo(() => {
    if (compareLeft == null || compareRight == null) return null;
    const left = revisions.find((r) => r.revision_id === compareLeft);
    const right = revisions.find((r) => r.revision_id === compareRight);
    if (!left || !right) return null;
    return diffDocuments(left.data, right.data);
  }, [compareLeft, compareRight, revisions]);

  return (
    <Card className="mt-5">
      <CardHeader>
        <CardTitle>Revisions</CardTitle>
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
            {revisions.map((rev) => (
              <TableRow key={rev.revision_id}>
                <TableCell data-label="#">#{rev.revision_id}</TableCell>
                <TableCell data-label="Created">{new Date(rev.created_at).toLocaleString()}</TableCell>
                <TableCell data-label="Note" className="whitespace-normal">
                  {rev.revision_note || "—"}
                </TableCell>
                <TableCell data-label="Public">{rev.public ? "Yes" : "No"}</TableCell>
                <TableCell data-label="Compare">
                  <label className="mr-3 inline-flex items-center gap-1 text-xs font-normal">
                    <input
                      type="radio"
                      name="compare-left"
                      checked={compareLeft === rev.revision_id}
                      onChange={() => setCompareLeft(rev.revision_id)}
                    />
                    L
                  </label>
                  <label className="inline-flex items-center gap-1 text-xs font-normal">
                    <input
                      type="radio"
                      name="compare-right"
                      checked={compareRight === rev.revision_id}
                      onChange={() => setCompareRight(rev.revision_id)}
                    />
                    R
                  </label>
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

        {diffRows !== null && (
          <div className="mt-4">
            <h4 className="mb-2 font-medium">
              Comparing #{compareLeft} → #{compareRight}
            </h4>
            <DiffTable rows={diffRows} />
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-muted-foreground">
                Raw JSON side by side
              </summary>
              <div className="mt-2 flex flex-col gap-3 md:flex-row">
                <pre className="min-w-0 flex-1 overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap break-words max-h-[400px]">
                  {prettyJson(revisions.find((r) => r.revision_id === compareLeft)?.data)}
                </pre>
                <pre className="min-w-0 flex-1 overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap break-words max-h-[400px]">
                  {prettyJson(revisions.find((r) => r.revision_id === compareRight)?.data)}
                </pre>
              </div>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
