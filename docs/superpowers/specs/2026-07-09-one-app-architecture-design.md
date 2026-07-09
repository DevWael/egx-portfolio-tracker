# One-App Architecture — Design Spec

## Summary

Collapse the pnpm-workspace monorepo (`packages/core`, `apps/web`, `apps/mcp`) into a single
Next.js application at the repo root. The MCP server moves from a stdio binary (spawned
per Claude Code session) to an HTTP endpoint (`app/api/mcp/route.ts`) served by the same
`next start` process that serves the dashboard. One package, one process, one port.

## Motivation

The original design ([2026-07-03 core design spec](2026-07-03-egx-portfolio-tracker-design.md))
deliberately split into three packages ("thin shells over a shared core") and explicitly
deferred HTTP/SSE transport for MCP ([2026-07-04 MCP design spec](2026-07-04-mcp-server-design.md)).
That was the right call at the time. This spec supersedes both decisions: the user wants a
single app to run and maintain, and is fine trading the "MCP only runs when needed" property
of stdio for the simplicity of one always-on process.

## Scope

- **In:** flatten `apps/web`, `apps/mcp`, `packages/core` into one root package; MCP over HTTP
  via the MCP SDK's `WebStandardStreamableHTTPServerTransport`; delete the pnpm workspace;
  single `vitest` run; update README.
- **Out:** authentication on the MCP endpoint (local-only, no network exposure — deferred until
  that changes), stateful/SSE session mode (stateless JSON is sufficient for a single local
  client), any change to the data model, business logic, or UI.

## Runtime & deployment model

Local machine only. `next start` (or `next dev`) is left running continuously — this is the one
real behavior change from today, where `apps/mcp` was spawned per Claude Code session and cost
nothing while idle. Claude Code is reconfigured to connect via URL instead of spawning a command:

```
{ "url": "http://localhost:3000/api/mcp" }
```

No auth, no HTTPS — not exposed beyond localhost.

## Target file layout

```
EGX/                          (repo root = the app)
  app/
    api/mcp/route.ts          NEW — MCP HTTP endpoint (POST/GET/DELETE)
    page.tsx, transactions/, watchlist/, digest/, export/    moved up from apps/web/app
  components/                 moved up from apps/web/components
  lib/
    db.ts                     unchanged — shared singleton, now also used by the MCP route
    data.ts, format.ts, metrics.ts, stats.ts, ticker.ts, backup.ts   moved up, unchanged
    core/                     packages/core/src/* moved here, subfolder structure preserved
      db/  repositories/  portfolio/  alerts/  digest/  eodhd/  services/  types.ts
    mcp/                      apps/mcp/src/* moved here, minus db.ts and index.ts
      tools.ts  money.ts  server.ts
  test/
    core/                     packages/core/test/* moved here
    mcp/                      apps/mcp/test/* moved here (server.test.ts rewritten, see Testing)
    format.test.ts, stats.test.ts    stay where they are (apps/web/test/*, moved up)
  data/egx.db (+ backups/)    same DB file, path changes from apps/web/data/ to data/
  scripts/
    backup.mjs                moved up from apps/web/scripts
    demo.ts                   moved up from packages/core/scripts, kept as a demo script
  package.json                single package, merged deps and scripts
  next.config.ts               unchanged (see below)
  tsconfig.json                single config, merged from tsconfig.base.json + apps/web/tsconfig.json
  vitest.config.ts             single config covering test/core, test/mcp, test/*
```

Deleted entirely: `apps/mcp/`, `packages/core/`, `pnpm-workspace.yaml`, `apps/web/` (contents
moved up, directory removed), the root `package.json` that only existed to drive `pnpm -r`,
`tsconfig.base.json` (folded into the single root `tsconfig.json`).

## MCP transport

**Choice: `WebStandardStreamableHTTPServerTransport`** (from `@modelcontextprotocol/sdk`,
already present at v1.29.0 in `apps/mcp/node_modules` — no version bump needed once hoisted to
root). It operates on Web-standard `Request`/`Response`/`ReadableStream`, which is exactly what
Next.js Route Handlers use. The alternative, the Express-flavored `StreamableHTTPServerTransport`,
expects Node's raw `req`/`res` and would need an adapter layer plus an Express-shaped dependency
that a Next app has no other use for — rejected.

**Session mode: stateless.** `sessionIdGenerator: undefined`, `enableJsonResponse: true`. This is
a single local client (Claude Code) calling synchronous, quick DB-backed tools — no server-initiated
push, no need for the SSE/resumable-session machinery the stateful mode exists for. If Claude Code's
HTTP MCP client is ever found to require session negotiation, flipping to stateful is a config
change in `route.ts`, not a redesign.

**Wiring:** `lib/mcp/server.ts` builds the `McpServer` and registers tools from `lib/mcp/tools.ts`
(unchanged from today, just relocated). `app/api/mcp/route.ts` holds a module-scope singleton of
the transport + server (mirroring the `globalThis.__egxDb` singleton pattern already in `lib/db.ts`),
and exports `POST`/`GET`/`DELETE` handlers that each call `transport.handleRequest(request)`.

## What survives unchanged

- `lib/db.ts`'s singleton — the MCP route calls the same `getDb()` the web UI's Server Components
  and Actions call. `apps/mcp/src/db.ts` (which only pointed `getDb()` at the same file via a
  relative path) is deleted outright, not migrated — there's nothing left for it to do.
- The webpack + `extensionAlias` workaround in `next.config.ts`. This exists because the
  codebase's internal ESM imports use `.js` specifiers pointing at `.ts` files (standard TS-ESM
  convention) — that's a source-code convention, not a package-boundary artifact, so merging
  packages doesn't remove the need for it. `transpilePackages: ["@egx/core"]` is removed since
  there's no longer a separate package to transpile; everything else in `next.config.ts` stays.
- All EGP↔piaster conversion and tool-schema logic in `lib/mcp/money.ts` / `lib/mcp/tools.ts` —
  copied verbatim, only import paths change (`@egx/core` → relative `../core/...`).
- The data model, migrations, business logic in `lib/core/*` — copied verbatim from
  `packages/core/src/*`, no logic changes.

## Data flow

Claude Code → HTTP POST `localhost:3000/api/mcp` → `route.ts` → `transport.handleRequest()` →
`McpServer` → tool handler in `lib/mcp/tools.ts` → `lib/db.ts` + `lib/core/*`. The web UI hits the
same `lib/db.ts` singleton via Server Components/Actions, same as today. One process, one DB
connection, no cross-process coordination — there wasn't real coordination before either, just two
processes independently opening the same SQLite file in WAL mode.

## Testing

Single `vitest.config.ts` at root, run via one `pnpm test`. `packages/core/test/*` moves to
`test/core/` unchanged. `apps/mcp/test/*` moves to `test/mcp/` with one exception:
`server.test.ts`'s stdio-boot smoke test is replaced with a route-handler smoke test that POSTs
an `initialize` JSON-RPC request to the handler and asserts a valid MCP response — the stdio
transport it tested no longer exists. `apps/web/test/*` (`format.test.ts`, `stats.test.ts`) moves
up to `test/` unchanged. Total test count should stay ~76 (50 core + 11 web + 15 mcp, with one
mcp test rewritten rather than dropped).

## Error handling

No new error-handling surface beyond what MCP's SDK transport already does (malformed JSON-RPC,
missing session ID on stateful-only operations — moot here since stateless, unsupported HTTP
methods). Tool-level error handling (graceful degradation on price-fetch failure, etc.) is
unchanged, copied verbatim from `apps/mcp/src/tools.ts`.

## Documentation updates

- `README.md`: rewrite the "Architecture" section to describe the flat single-package layout;
  rewrite "MCP server (Claude Code)" section to show the HTTP registration instead of
  `claude mcp add egx -- pnpm -C ... start`; update the "Tests" line's package-scoped commands
  to plain `pnpm test`.
- Existing specs/plans under `docs/superpowers/` are left untouched as historical record of the
  monorepo-era decisions this spec supersedes.

## Non-goals / explicitly deferred

- Auth on the MCP endpoint (revisit if this ever runs anywhere but localhost).
- Stateful/SSE MCP session mode.
- Any change to business logic, schema, or UI.
