import { store } from "@/store/store";
import { clearSession, loadLastApiBase } from "@/lib/auth/session";

export type ApiErrorKind =
  | "network"
  | "unauthorized"
  | "forbidden"
  | "conflict"
  | "validation"
  | "http";

export class ApiError extends Error {
  status: number;
  kind: ApiErrorKind;
  detail: string;
  // Parsed 422 field errors: {field: [msg, ...]}
  fields: Record<string, string[]> | null;
  // Structured error bodies. Today this is only the duplicate-conflict
  // payload — see `DuplicateConflict` in lib/api/tracking.ts — which is the
  // one response whose `detail` is an object rather than a string.
  payload: unknown;

  constructor(
    status: number,
    kind: ApiErrorKind,
    detail: string,
    fields?: Record<string, string[]> | null,
    payload?: unknown,
  ) {
    super(detail);
    this.status = status;
    this.kind = kind;
    this.detail = detail;
    this.fields = fields ?? null;
    this.payload = payload;
  }
}

interface ValidationErrorEntry {
  loc: (string | number)[];
  msg: string;
}

// FastAPI's 422 body, minus the `input` echo — see
// Application._handle_validation_error in main.py.
export function parseValidationErrors(detail: ValidationErrorEntry[]): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const err of detail) {
    // loc is ["body", "field"] or ["body", "field", 0, "subfield"]; the
    // leading "body"/"query"/"path" segment is not a field name.
    const path = err.loc.slice(1).join(".");
    (fields[path] ??= []).push(err.msg);
  }
  return fields;
}

interface RequestOptions {
  body?: unknown;
  form?: Record<string, string>;
  auth?: boolean;
  apiBase?: string;
}

export async function request<T>(
  method: string,
  path: string,
  { body, form, auth = true, apiBase }: RequestOptions = {},
): Promise<T> {
  const session = store.state.session;
  const base = apiBase || session?.apiBase || loadLastApiBase();
  const headers: Record<string, string> = {};
  let payload: string | undefined;
  if (form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    payload = new URLSearchParams(form).toString();
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  if (auth && session?.token) {
    headers["Authorization"] = `Bearer ${session.token}`;
  }

  let response: Response;
  try {
    response = await fetch(base + path, { method, headers, body: payload });
  } catch {
    throw new ApiError(
      0,
      "network",
      "Could not reach the server. This is almost always a CORS problem: " +
        "make sure CLIENT_ALLOWED_ORIGINS on the server includes this page's " +
        "origin, or that the API base URL above is correct and the server is running.",
    );
  }

  if (response.status === 401 && auth) {
    clearSession();
    store.set({ session: null });
    throw new ApiError(401, "unauthorized", "Your session has expired. Log in again.");
  }

  if (!response.ok) {
    let detail = response.statusText || `HTTP ${response.status}`;
    let fields: Record<string, string[]> | null = null;
    let payload: unknown;
    let kind: ApiErrorKind = "http";
    if (response.status === 403) kind = "forbidden";
    else if (response.status === 409) kind = "conflict";
    else if (response.status === 422) kind = "validation";
    try {
      const data = await response.json();
      if (Array.isArray(data.detail)) {
        fields = parseValidationErrors(data.detail);
        detail = data.detail
          .map((e: ValidationErrorEntry) => `${e.loc.slice(1).join(".")}: ${e.msg}`)
          .join("; ");
      } else if (typeof data.detail === "string") {
        detail = data.detail;
      } else if (data.detail && typeof data.detail === "object") {
        payload = data.detail;
        if (typeof data.detail.message === "string") detail = data.detail.message;
      }
    } catch {
      // Non-JSON error body; the status text above is all there is.
    }
    throw new ApiError(response.status, kind, detail, fields, payload);
  }

  if (response.status === 204) return null as T;
  return response.json() as Promise<T>;
}

export function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.detail : String(err);
}
