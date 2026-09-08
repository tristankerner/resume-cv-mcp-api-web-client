import { useState } from "react";

import { Banner } from "@/components/common/Banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import * as auditApi from "@/lib/api/audit";
import type { AuditEntry, AuditOperation } from "@/lib/api/audit";
import { ApiError, errorMessage } from "@/lib/api/client";
import { canReadAudit } from "@/lib/auth/scopes";
import { useStore } from "@/store/useStore";

const OP_LABEL: Record<AuditOperation, string> = { I: "Created", U: "Updated", D: "Deleted" };
const OP_VARIANT: Record<AuditOperation, "success" | "outline" | "secondary"> = {
  I: "success",
  U: "outline",
  D: "secondary",
};

// Objects and long strings render as an ellipsis with the full value in a
// `title` attribute rather than a JSON viewer.
function formatValue(value: unknown): { text: string; title?: string } {
  if (value === null || value === undefined) return { text: "—" };
  const isObject = typeof value === "object";
  const str = isObject ? JSON.stringify(value) : String(value);
  if (isObject || str.length > 120) return { text: "…", title: str };
  return { text: str };
}

function whoLabel(entry: AuditEntry, currentUserId: number | undefined): string {
  const identity =
    entry.actor_user_id === null
      ? "outside the app"
      : entry.actor_user_id === currentUserId
        ? "you"
        : "another session";
  return entry.actor_credential ? `${identity} · ${entry.actor_credential}` : identity;
}

export function HistoryPanel({ table, rowId }: { table: string; rowId: number }) {
  const { user } = useStore();
  const [expanded, setExpanded] = useState(false);
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canReadAudit(user)) return null;

  async function expand() {
    setExpanded(true);
    if (entries !== null) return;
    setError(null);
    try {
      const resp = await auditApi.listAudit({ table, row_id: rowId, limit: 50 });
      setEntries(resp.data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setError(errorMessage(err));
    }
  }

  if (!expanded) {
    return (
      <Button variant="outline" size="sm" onClick={expand}>
        Show history
      </Button>
    );
  }

  return (
    <div>
      <h3 className="mb-2 font-medium">History</h3>
      <Banner kind="error">{error}</Banner>
      {entries === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No history yet.</p>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={OP_VARIANT[entry.operation]}>{OP_LABEL[entry.operation]}</Badge>
                <span className="text-muted-foreground">{new Date(entry.changed_at).toLocaleString()}</span>
                <span className="text-muted-foreground">{whoLabel(entry, user?.id)}</span>
              </div>
              {entry.operation === "U" && entry.changed_columns && entry.changed_columns.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {entry.changed_columns.map((col) => {
                    const oldVal = formatValue(entry.old_data?.[col]);
                    const newVal = formatValue(entry.new_data?.[col]);
                    return (
                      <li key={col} className="text-xs">
                        <span className="font-medium">{col}</span>:{" "}
                        <span title={oldVal.title}>{oldVal.text}</span>
                        {" → "}
                        <span title={newVal.title}>{newVal.text}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
