import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";

import { ApiError, errorMessage } from "@/lib/api/client";
import { asDuplicateConflict, type DuplicateConflict } from "@/lib/api/tracking";
import { store } from "@/store/store";
import type { Resource } from "@/store/refresh";

export interface InlineCommitResult {
  ok: boolean;
  conflict?: DuplicateConflict;
  error?: string;
}

// Owns the optimistic update for a single-cell PATCH: writes the new value
// into the row immediately, sends the PATCH, and on success splices the
// server's row into place (guaranteed identical in shape to a list row) —
// on any failure it restores the fields to their pre-edit values. A 409
// duplicate conflict is reported back rather than treated as a plain error,
// so the cell can stay in edit mode and render the candidates.
export function useInlineEdit<Row>() {
  const commit = useCallback(
    async <Body extends Record<string, unknown>>(opts: {
      rowId: number;
      getId: (row: Row) => number;
      setRows: Dispatch<SetStateAction<Row[]>>;
      previousValues: Partial<Row>;
      optimisticValues: Partial<Row>;
      patch: (id: number, body: Body) => Promise<Row>;
      body: Body;
      invalidates?: readonly Resource[];
    }): Promise<InlineCommitResult> => {
      const { rowId, getId, setRows, previousValues, optimisticValues, patch, body, invalidates } = opts;
      setRows((current) => current.map((r) => (getId(r) === rowId ? { ...r, ...optimisticValues } : r)));
      try {
        const updated = await patch(rowId, body);
        setRows((current) => current.map((r) => (getId(r) === rowId ? updated : r)));
        if (invalidates && invalidates.length > 0) store.invalidate(...invalidates);
        return { ok: true };
      } catch (err) {
        setRows((current) => current.map((r) => (getId(r) === rowId ? { ...r, ...previousValues } : r)));
        const dup = asDuplicateConflict(err);
        if (dup) return { ok: false, conflict: dup };
        if (err instanceof ApiError && err.status === 401) return { ok: false };
        return { ok: false, error: errorMessage(err) };
      }
    },
    [],
  );

  return { commit };
}
