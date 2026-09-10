import { API_BASE_STORAGE_KEY, DEFAULT_API_BASE, SERVED_BY_API_PATH, SESSION_STORAGE_KEY } from "@/lib/config";

// The refresh token below lives in localStorage, readable by any script on
// this origin — not an HttpOnly cookie. That is a deliberate trade-off, not
// an oversight: the single-file build must work from file://, where cookies
// are unreliable (see THEMING_AND_SESSION_PLAN.md §4.3/rule 5), so
// localStorage is the only persistence available to either token. What makes
// this acceptable: the refresh token rotates on every use (`POST
// /token/refresh` returns a new one and revokes the one presented), reusing
// an already-rotated token revokes the *whole* session chain server-side
// rather than just that one token, and this build's no-CDN/no-remote-script
// posture means a script able to read localStorage here would already imply
// the served artifact itself had been tampered with.
export interface Session {
  apiBase: string;
  token: string;
  exp: number;
  username: string;
  // Both null for a session persisted before refresh tokens existed — see
  // the migration branch in loadSession below. Never null for a session
  // created by the current login/refresh code.
  refreshToken: string | null;
  // Seconds since epoch, same unit as `exp`. The server never tells the
  // client how long a refresh token stays redeemable (see config.ts's
  // REFRESH_TOKEN_ASSUMED_LIFETIME_SECONDS), so this is a client-side
  // estimate, not a value read off the token.
  refreshExp: number | null;
}

// Session storage — the Session shape above under one key. `exp` is read
// from the JWT payload by base64-decoding it, never signature-checked here:
// that is only to decide when to stop trying, never to authorize anything.
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

    if (!parsed.refreshToken || !parsed.refreshExp) {
      // Migration: a session saved before this field existed. There is
      // nothing to refresh into, so it falls back to the old rule (expired
      // once `exp` is within 60s) instead of the refreshExp check below —
      // otherwise a pre-existing session would look permanently valid.
      if (parsed.exp * 1000 < Date.now() + 60_000) return null;
      return { ...parsed, refreshToken: null, refreshExp: null } as Session;
    }

    // An expired *access* token with a live refresh token is recoverable —
    // discarding it here would be the exact bug this plan fixes. Only a
    // dead refresh token forces a real login.
    if (parsed.refreshExp * 1000 < Date.now()) return null;
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
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  localStorage.removeItem(SESSION_STORAGE_KEY);
  if (!raw) return;
  try {
    const { apiBase, refreshToken } = JSON.parse(raw) as Partial<Session>;
    if (!apiBase || !refreshToken) return;
    // Fire-and-forget, and a raw fetch rather than lib/api/auth's logout():
    // that module imports lib/api/client, which imports this file, and
    // importing it back here would be a cycle. There is also no response to
    // act on — a sign-out proceeds locally either way.
    fetch(`${apiBase}/token/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ refresh_token: refreshToken }).toString(),
    }).catch(() => {});
  } catch {
    // Malformed stored session; nothing to revoke server-side.
  }
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
