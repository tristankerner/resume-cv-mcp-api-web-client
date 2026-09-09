import { useCallback, useState } from "react";

import { ApiError, errorMessage } from "@/lib/api/client";
import { asDuplicateConflict, type DuplicateConflict } from "@/lib/api/tracking";

export interface AsyncActionOptions<T> {
  onSuccess?: (result: T) => void;
}

// The busy/error/401-swallow triple that used to be hand-rolled at every call
// site. A 401 is not surfaced as an error: the client module has already
// cleared the session and navigated to login by the time it reaches here.
export function useAsyncAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateConflict, setDuplicateConflict] = useState<DuplicateConflict | null>(null);

  const reset = useCallback(() => {
    setError(null);
    setDuplicateConflict(null);
  }, []);

  const run = useCallback(
    async <T>(action: () => Promise<T>, options: AsyncActionOptions<T> = {}): Promise<{ ok: boolean }> => {
      setBusy(true);
      setError(null);
      setDuplicateConflict(null);
      try {
        const result = await action();
        options.onSuccess?.(result);
        return { ok: true };
      } catch (err) {
        const dup = asDuplicateConflict(err);
        if (dup) {
          setDuplicateConflict(dup);
          return { ok: false };
        }
        if (err instanceof ApiError && err.status === 401) return { ok: false };
        setError(errorMessage(err));
        return { ok: false };
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  return { run, busy, error, duplicateConflict, reset };
}
