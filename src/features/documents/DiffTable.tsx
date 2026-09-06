import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { sectionOf, type DiffRow, type JsonValue } from "@/lib/documents/diff";

function formatDiffValue(v: JsonValue | undefined) {
  if (v === undefined) return <em className="text-muted-foreground">—</em>;
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function DiffTable({ rows }: { rows: DiffRow[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, DiffRow[]>();
    for (const row of rows) {
      const section = sectionOf(row.path);
      if (!map.has(section)) map.set(section, []);
      map.get(section)!.push(row);
    }
    return [...map.entries()];
  }, [rows]);

  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No differences.</p>;

  return (
    <div className="space-y-4">
      {grouped.map(([section, sectionRows]) => (
        <div key={section}>
          <h4 className="mb-2 font-medium">{section}</h4>
          <Table className="table-reflow">
            <TableHeader>
              <TableRow>
                <TableHead>Path</TableHead>
                <TableHead>Left</TableHead>
                <TableHead>Right</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sectionRows.map((row) => (
                <TableRow key={row.path}>
                  <TableCell data-label="Path">
                    <code className="rounded bg-muted px-1 py-0.5 text-xs">{row.path}</code>{" "}
                    <Badge variant="outline">{row.kind}</Badge>
                  </TableCell>
                  <TableCell data-label="Left" className="whitespace-normal">
                    {formatDiffValue(row.left)}
                  </TableCell>
                  <TableCell data-label="Right" className="whitespace-normal">
                    {formatDiffValue(row.right)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
    </div>
  );
}
