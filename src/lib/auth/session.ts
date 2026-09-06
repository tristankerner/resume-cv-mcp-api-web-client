import { API_BASE_STORAGE_KEY, DEFAULT_API_BASE, SERVED_BY_API_PATH, SESSION_STORAGE_KEY } from "@/lib/config";

export interface Session {
  apiBase: string;
  token: string;
  exp: number;
  username: string;
}

// Session storage — {apiBase, token, exp, username} under one key. `exp` is
// read from the JWT payload by base64-decoding it, never signature-checked
// here: that is only to decide when to stop trying, never to authorize
// anything.
export function decodeJwtExp(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(normalized));
    return typeof json.exp === "number" ? json.exp : null;
  } catch {
    return null;
  }
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (!parsed || !parsed.token || !parsed.apiBase || !parsed.exp) return null;
    if (parsed.exp * 1000 < Date.now() + 60_000) return null;
    return parsed as Session;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  localStorage.setItem(API_BASE_STORAGE_KEY, session.apiBase);
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

// The origin this page came from, when it came from the API itself.
//
// `location.origin` alone is not the test: a static file server hands this
// page out at `/` or `/index.html` and is not an API, and defaulting to it
// would be wrong in exactly the way the localhost default already is. The
// path is what distinguishes the two — main.py registers GET /client and
// nothing else serves this file there. A file:// page has no useful origin at
// all (`location.origin` is the string "null"), which the scheme check
// covers.
export function apiOriginServingThisPage(): string | null {
  const { origin, pathname } = window.location;
  if (!origin.startsWith("http")) return null;
  return pathname.replace(/\/+$/, "") === SERVED_BY_API_PATH ? origin : null;
}

export function loadLastApiBase(): string {
  // Served from the API, the base URL is not a preference to remember — it
  // is a fact about where this page came from, and it outranks a stored
  // value left over from pointing the same client somewhere else. The field
  // stays editable; this only decides what it starts as.
  return (
    apiOriginServingThisPage() ||
    localStorage.getItem(API_BASE_STORAGE_KEY) ||
    DEFAULT_API_BASE
  );
}
