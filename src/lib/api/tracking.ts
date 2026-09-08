import { ApiError } from "@/lib/api/client";

export interface ListEnvelope<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface DuplicateCandidate {
  id: number;
  label: string;
  match: "exact" | "contains" | "fuzzy";
  score: number;
  hint: string | null;
}

export interface DuplicateConflict {
  code: string;
  message: string;
  candidates: DuplicateCandidate[];
}

function isDuplicateConflict(payload: unknown): payload is DuplicateConflict {
  return (
    !!payload &&
    typeof payload === "object" &&
    Array.isArray((payload as { candidates?: unknown }).candidates)
  );
}

export function asDuplicateConflict(err: unknown): DuplicateConflict | null {
  if (!(err instanceof ApiError) || err.status !== 409) return null;
  return isDuplicateConflict(err.payload) ? err.payload : null;
}

export type QueryParams = Record<string, string | number | boolean | string[] | null | undefined>;

export function buildQuery(params: QueryParams): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    const values = Array.isArray(value) ? value : [value];
    for (const v of values) {
      if (v === null || v === undefined || v === "") continue;
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.length > 0 ? `?${parts.join("&")}` : "";
}
