# resume-mcp-api-clients

Front-end clients for [`resume-mcp-api`](https://github.com/tristankerner/resume-mcp-api).

"Client" means several things across that project's docs — an AI/MCP client
(Claude Desktop, etc.), an OAuth client, and a front-end UI. This repository
is only the last of those: user-facing applications that talk to the API over
HTTP.

## What's here

```
web/   the browser client — a single-file UI, no build step required
```

`web/` is the only client today.

## Layout

One top-level directory per client, named for its platform. Each is
self-contained: its own `README.md` explaining what it is and how to run it,
and its own build entry point if it needs one. Nothing is shared at the root
beyond this file.

Adding a new client — a TUI, a native mobile app, whatever comes next — is
`mkdir <platform>` plus a README in it. No root file changes, no shared build
tooling to wire up, no workspace manifest to edit. That's deliberate: a
shared root `package.json` or workspace config would need editing every time
a client is added, and the whole point of this layout is that adding one
never touches anything outside its own directory.

## API contract

None of that is duplicated here. Each client's README says which endpoints it
uses in passing, but the actual contract — request/response shapes, auth,
error handling — lives in `resume-mcp-api`'s own docs.
