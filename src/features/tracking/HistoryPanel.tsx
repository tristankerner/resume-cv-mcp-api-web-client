import { useState } from "react";

import { Banner } from "@/components/common/Banner";
import { DateTimeText } from "@/components/common/DateTime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Item, ItemContent, ItemTitle } from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import { useRefreshOn } from "@/hooks/useRefreshOn";
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

  useRefreshOn(["audit"], () => {
    if (expanded) refetch();
  });

  if (!canReadAudit(user)) return null;

  async function refetch() {
    setError(null);
    try {
      const resp = await auditApi.listAudit({ table, row_id: rowId, limit: 50 });
      setEntries(resp.data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setError(errorMessage(err));
    }
  }

  async function expand() {
    setExpanded(true);
    if (entries !== null) return;
    await refetch();
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
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner /> Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No history yet.</p>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Item variant="outline" className="flex-col items-start">
                <ItemTitle className="font-normal">
                  <Badge variant={OP_VARIANT[entry.operation]}>{OP_LABEL[entry.operation]}</Badge>
                  <span className="text-muted-foreground"><DateTimeText value={entry.changed_at} /></span>
                  <span className="text-muted-foreground">{whoLabel(entry, user?.id)}</span>
                </ItemTitle>
                {entry.operation === "U" && entry.changed_columns && entry.changed_columns.length > 0 && (
                  <ItemContent>
                    <ul className="space-y-1">
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
                  </ItemContent>
                )}
              </Item>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
