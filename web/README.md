# Web client

A single-file browser UI for managing documents and API keys against this
service. No build step, no dependencies to install — `index.html` runs
exactly as it sits in this directory.

This is the *browser client* sense of "client" — a front-end UI. Elsewhere in
the `resume-mcp-api` docs, "client" also means an AI/MCP client (Claude
Desktop, etc.) and an OAuth client; this repository is only about the first
sense.

## Before it can talk to anything: CORS

The server does not allow browser access to `/token`, `/documents`,
`/api-keys` or `/users/*` unless the calling origin is explicitly
allowlisted. Set `CLIENT_ALLOWED_ORIGINS` on the server before opening this
client — see `resume-mcp-api`'s `.env.example` and the "Browser client"
section of its `README.md`. Every failure mode below traces back to this
one setting:

- Running a local dev server (`python3 -m http.server 5173`, or similar)?
  Allowlist that origin, e.g. `http://localhost:5173`. This is what
  `.env.example` ships, and it is the one to prefer.
- Opened over `file://`? Allowlist the literal string `null` — that is what a
  page opened directly from disk sends as its `Origin`. Prefer the dev server
  above if you have the choice: `null` is also what *any* website gets by
  making its request from a sandboxed iframe, so allowlisting it lets an
  arbitrary page read this API's unauthenticated responses using the browser
  of whoever visits it. Nothing authenticated is exposed — there are no
  cookies, and your token lives in another origin's `localStorage` — but a
  `/token` reply is, which is enough to test credentials from a stranger's
  browser. `.env.example` spells this out; local use only.
- Hosting it for real? Allowlist the origin it is actually served from.

If a request fails with no HTTP status at all, the client says so directly —
that failure mode is almost always this.

## Running it

**Option 1 — a local static server.** Any will do:

```bash
cd web
python3 -m http.server 5173
```

Then open `http://localhost:5173`. `CLIENT_ALLOWED_ORIGINS` needs that
origin, which is what `.env.example` already sets. It imports Preact, `htm`,
and vanilla-jsoneditor from jsdelivr at pinned versions, so this needs
network access to the CDN but nothing else.

**Option 2 — straight off disk.** Open `index.html` directly in a browser
(double-click it, or `file:///path/to/web/index.html`). This needs
`CLIENT_ALLOWED_ORIGINS` to include `null`, with the caveat above — take
option 1 instead unless you have a reason not to.

**Option 3 — fully offline / a single self-contained file.**

```bash
./build.sh
```

Produces `dist/index.html` (gitignored): the two CDN imports fetched,
verified against the same integrity hashes the browser itself checks, and
inlined by esbuild. The result is one file, roughly 1.3 MB, that works from
`file://` with no network access at all — hand it to someone, or archive it.
Requires Node.js; installs `esbuild` locally into `web/node_modules/`
(also gitignored) on first run.

**Option 4 — served by the API itself.** Set `CLIENT_HTML_PATH` on the server
and `GET /client` serves that file. This is the simplest way to put the client
in front of a deployed API: it is same-origin, so `CLIENT_ALLOWED_ORIGINS` does
not need to name it, and the API base URL arrives pre-filled — a page served
at `/client` knows the API is wherever it came from, and says so instead of
asking. Nothing to configure on either side beyond the one path.

In the deploy image that path is `/app/clients/web/index.html`, which is
where `COPY . /app` already puts it. A built `dist/index.html` works too when
running locally, but `.dockerignore` deliberately keeps `dist/` and
`node_modules/` out of the image: both are gitignored, so a stale build would
be served to real users with nothing having reviewed it.

The response carries `Content-Security-Policy: frame-ancestors 'none'`
(this page has a login form on it), `X-Content-Type-Options: nosniff`, and
`Referrer-Policy: no-referrer`. `script-src` is deliberately not set — see the
comment on `CLIENT_HEADERS` in `main.py` for why a hash or `unsafe-inline`
would be the only options and neither is worth it.

## CDN vs. bundled — which to use

`index.html` is the source of truth and is always runnable as-is; nobody has
to install Node to fix a typo in a label. Reach for `dist/index.html` only
when you specifically want a single file with no runtime network dependency
on jsdelivr — an offline demo, an air-gapped environment, or just wanting one
fewer moving part. Both talk to the same API and behave identically; the
build step changes nothing but how the two editor libraries are loaded.

## What's here

```
index.html   the app — state, the API client, and every view, in one file
build.sh     optional: bundles index.html into dist/index.html
dist/        build output (gitignored)
node_modules/  esbuild, installed locally by build.sh (gitignored)
```

There is no framework build step, no bundler config, and no package.json for
the app itself — `index.html` is plain ES modules loaded by the browser
directly. `build.sh` exists solely to produce the offline artifact in Option
3 above.

## Mobile

Responsive down to a phone, from the same file — one stylesheet, one
breakpoint at 720px. API key management (list, check what's expiring,
revoke, mint a replacement) is the task this client is built to be good at
from a phone; document editing works but is honestly secondary — a touch
keyboard was never going to make deeply nested JSON pleasant, and the editor
defaults to tree mode below the breakpoint for exactly that reason.

Two platform quirks worth knowing about rather than mistaking for bugs:

- **iOS Safari evicts `localStorage`** for a site not opened in seven days,
  more aggressively under storage pressure. The cached session disappears
  and the login screen reappears — that is the platform, not this app losing
  your token. Use `autocomplete` (already wired up on every credential
  field) and let a password manager remember the password so re-entering it
  is quick.
- **`file://`'s security context varies by browser.** Some treat it as
  secure, some do not, and that changes whether the Clipboard API is
  available in the one-time API key reveal. The client feature-detects this
  at runtime rather than assuming — if the Copy button is not there, select
  the key text and copy it manually (Cmd/Ctrl-C, or a long-press "Copy" on
  mobile); the field is never marked unselectable.
