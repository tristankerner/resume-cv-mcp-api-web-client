// Company websites and application URLs are free text the user — or, now
// that tracking write scopes are issuable over OAuth, an MCP connector acting
// on a job posting it fetched — put into the record. Rendering one straight
// into `href` makes `javascript:...` a click away from running script in this
// origin, which is the origin holding the session token in localStorage.
//
// The API rejects a non-http(s) scheme on the way in. This is the second
// half: rows written before that validation existed still come back, and a
// client that only renders what a server promised is a client that breaks the
// day the promise does.
const SAFE_SCHEMES = ["http:", "https:"];

/** The URL if it is safe to link to, otherwise `undefined`. */
export function safeHref(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  let parsed: URL;
  try {
    // Parsed rather than prefix-matched: `\njavascript:...` and
    // `JaVaScRiPt:...` both defeat a naive startsWith, and the URL parser
    // normalizes the leading control characters and the case the same way the
    // browser's own navigation does.
    parsed = new URL(trimmed);
  } catch {
    return undefined;
  }
  return SAFE_SCHEMES.includes(parsed.protocol) ? trimmed : undefined;
}

/** Whether `value` can be rendered as a link at all. */
export function isSafeHref(value: string | null | undefined): boolean {
  return safeHref(value) !== undefined;
}
