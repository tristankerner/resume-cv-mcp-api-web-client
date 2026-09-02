# Web client

A browser UI for managing documents, API keys, second factors (an
authenticator app and backup codes), and — for an account holding
`users:admin` — user and OAuth client administration, against this service.

This is the *browser client* sense of "client" — a front-end UI. Elsewhere in
the `resume-mcp-api` docs, "client" also means an AI/MCP client (Claude
Desktop, etc.) and an OAuth client; this repository is only about the first
sense.

Built with Vite, React 19, TypeScript, Tailwind CSS v4 and shadcn/ui,
bundled down to **one HTML file** (`dist/index.html`, ~1.7 MB) — that
property is unchanged from the old hand-written client and is why the build
exists at all: `GET /client` serves this file same-origin with no
`script-src` in its CSP (see the `CLIENT_HEADERS` comment in `main.py`), so
it has to work with nothing to fetch, from `file://` or from behind that
policy.

**This gave up something the old client had: no build step.** Earlier
versions of this README described running `index.html` straight off a CDN,
or entirely offline via `python3 -m http.server`, with no `npm install`
anywhere. That property is gone — this is a real app now, split into
components, and getting there needed a real toolchain. If you just need to
fix a label, you now need Node.

## Before it can talk to anything: CORS

The server does not allow browser access to `/token`, `/documents`,
`/api-keys`, `/users/*` or `/oauth-clients` unless the calling origin is
explicitly allowlisted. Set `CLIENT_ALLOWED_ORIGINS` on the server before
opening this client — see `resume-mcp-api`'s `.env.example` and the "Browser
client" section of its `README.md`. Every failure mode below traces back to
this one setting:

- Running `npm run dev`? Allowlist that origin — `http://localhost:5173` by
  default. This is what `.env.example` ships, and it is the one to prefer.
- Opened the built `dist/index.html` over `file://`? Allowlist the literal
  string `null` — that is what a page opened directly from disk sends as its
  `Origin`. Prefer the dev server above if you have the choice: `null` is
  also what *any* website gets by making its request from a sandboxed
  iframe, so allowlisting it lets an arbitrary page read this API's
  unauthenticated responses using the browser of whoever visits it. Nothing
  authenticated is exposed — there are no cookies, and your token lives in
  another origin's `localStorage` — but a `/token` reply is, which is enough
  to test credentials from a stranger's browser. `.env.example` spells this
  out; local use only.
- Hosting it for real? Allowlist the origin it is actually served from.

If a request fails with no HTTP status at all, the client says so directly
(see `errorMessage`/`ApiError` in `src/lib/api/client.ts`) — that failure
mode is almost always this.

## Running it

```bash
npm ci
npm run dev
```

Opens on `http://localhost:5173`. `CLIENT_ALLOWED_ORIGINS` needs that origin
— see above.

## Building it

```bash
npm ci
npm run build
```

Runs `tsc -b`, then `vite build`, then `scripts/check-singlefile.mjs`, which
fails the build if `dist/index.html` still references anything external —
a local `src`/`href`, or an `https://` script URL. That property is exactly
what a Vite/plugin upgrade could silently break, and it is the one the
deploy repo (`resume-tristankerner-com`) depends on: `deploy/02-build.sh`
runs this build and copies `dist/index.html` into the API's build context,
where `GET /client` serves it.

`npm run preview` serves the built file locally if you want to sanity-check
it outside a dev server.

## Dependencies are pinned exactly

`package-lock.json` is committed; CI and the deploy repo run `npm ci`, which
fails on a lockfile that disagrees with `package.json` — that mismatch is
the point, not a bug to work around. The idea carries over from the old
client's CDN `integrity` hashes: nothing here is ever bumped to `@latest`
by hand-waving. Bump a dependency by changing its version in `package.json`
and running `npm install` to regenerate the lock, same as any other Vite
app.

## Checks

```bash
npm run typecheck   # tsc -b --noEmit
npm run test        # vitest run
npm run build        # tsc -b && vite build && the single-file assertion
```

All three are the gate. `npm run test` covers the pure logic only —
`src/lib/documents/diff.ts`, `src/lib/documents/names.ts`,
`src/lib/passwords.ts`, `src/lib/auth/session.ts` (JWT decoding, including a
malformed token), and `parseValidationErrors` in `src/lib/api/client.ts`
against a realistic 422 body. No component tests; not worth the harness at
this size — verify UI changes by running the dev server against a real API.

## Served by the API itself

Set `CLIENT_HTML_PATH` on the server and `GET /client` serves that file.
This is the simplest way to put the client in front of a deployed API: it
is same-origin, so `CLIENT_ALLOWED_ORIGINS` does not need to name it, and
the API base URL arrives pre-filled — a page served at `/client` knows the
API is wherever it came from, and says so instead of asking.

`CLIENT_HTML_PATH` must point at a **built** file — `dist/index.html`, not
this directory's Vite entry `index.html`, which is just a `<script
src="/src/main.tsx">` stub with nothing bundled into it. In the deploy image
that path is `/app/clients/web/index.html`, which `deploy/02-build.sh`
produces by running this repo's build and copying the output there — see
that repo's README for the full chain.

The response carries `Content-Security-Policy: frame-ancestors 'none'`
(this page has a login form on it), `X-Content-Type-Options: nosniff`, and
`Referrer-Policy: no-referrer`. `script-src` is deliberately not set — see
the comment on `CLIENT_HEADERS` in `main.py` for why a hash or
`unsafe-inline` would be the only options and neither is worth it. This is
exactly why the single-file build has to stay single-file: anything it
fetched at runtime would need a `script-src`/`connect-src` this response
doesn't send.

## What's here

```
index.html         Vite entry — <div id="root"> plus a module script, not the app
src/
  main.tsx          mount
  App.tsx            boot, session restore, view switch
  index.css          Tailwind v4 + shadcn theme tokens, dark by default
  lib/               API client, auth/session/scopes, documents, passwords,
                     clipboard, QR — all pure logic, unit tested
  store/             the tiny global store, ported to TypeScript
  components/ui/     shadcn-generated primitives — don't hand-edit, regenerate
  components/common/ Banner, ConfirmPasswordDialog, SecretReveal, EmptyState, ...
  components/layout/ AppShell, Header, Nav, SessionCountdown
  features/          one directory per view: auth, documents, api-keys,
                     account, security, admin
scripts/
  check-singlefile.mjs   the single-file build assertion, see above
dist/               build output (gitignored)
node_modules/       (gitignored)
```

`components.json` is the shadcn/ui config — `npx shadcn@latest add <name>`
adds a new primitive under `src/components/ui/`; don't hand-edit the
generated files beyond what shadcn itself produces, or a later `add`/update
silently clobbers the edit.

## Admin

Gated on the logged-in user holding the `users:admin` scope — the **Users**
and **OAuth clients** nav items, their routes, and every call in
`src/lib/api/admin.ts`. The server enforces this regardless; the client just
doesn't show doors that don't open. See `src/features/admin/`.

Two things the server refuses that are worth knowing before they surprise
you: creating a user, resetting a password, resetting MFA and managing OAuth
clients all need an **interactive login** — a session from `/token`, which is
what this client has — so none of it works with an API key. And registering
an OAuth client defaults to **confidential** (the API issues a secret, shown
once); turn on "Public client" only for one that cannot keep a secret, where
PKCE binds the exchange instead.

## Mobile

Responsive down to a phone: tables collapse to stacked cards and the JSON
editor defaults to tree mode below `md` (redefined to 720px in
`src/index.css`, rather than Tailwind's stock 768px — the old client's one
breakpoint, kept by name). API key management (list, check what's expiring,
revoke, mint a replacement) is the task this client is built to be good at
from a phone; document editing works but is honestly secondary — a touch
keyboard was never going to make deeply nested JSON pleasant.

Entering a TOTP code and reading backup codes belong on that same short
list — logging in from a phone is exactly where a second factor gets
checked most often. `autocomplete="one-time-code"` is wired up on every
code field, so iOS and Android can offer the code straight from the
SMS/clipboard suggestion bar instead of it being typed by hand.

Two platform quirks worth knowing about rather than mistaking for bugs:

- **iOS Safari evicts `localStorage`** for a site not opened in seven days,
  more aggressively under storage pressure. The cached session disappears
  and the login screen reappears — that is the platform, not this app
  losing your token. Use `autocomplete` (already wired up on every
  credential field) and let a password manager remember the password so
  re-entering it is quick.
- **`file://`'s security context varies by browser.** Some treat it as
  secure, some do not, and that changes whether the Clipboard API is
  available in a one-time secret reveal (an API key, a TOTP secret, an
  OAuth client secret). The client feature-detects this at runtime rather
  than assuming — if the Copy button is not there, select the text and copy
  it manually (Cmd/Ctrl-C, or a long-press "Copy" on mobile); the field is
  never marked unselectable.
