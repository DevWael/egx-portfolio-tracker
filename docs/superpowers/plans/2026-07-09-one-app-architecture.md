# One-App Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the pnpm-workspace monorepo (`packages/core`, `apps/web`, `apps/mcp`) into a single Next.js app at the repo root, with MCP served over HTTP from the same process instead of a separate stdio binary.

**Architecture:** `packages/core` and `apps/mcp`'s logic get absorbed into `apps/web/lib/{core,mcp}`, then the whole `apps/web` tree is flattened up to the repo root. MCP is exposed as `app/api/mcp/route.ts`, a Next.js Route Handler that creates a fresh `McpServer` + `WebStandardStreamableHTTPServerTransport` per request (stateless mode — required by the SDK, verified against `apps/mcp/node_modules/@modelcontextprotocol/sdk` v1.29.0 source: reusing a stateless transport across requests throws).

**Tech Stack:** Next.js 16 (webpack, not Turbopack), React 19, better-sqlite3, `@modelcontextprotocol/sdk` (`WebStandardStreamableHTTPServerTransport`), zod, vitest.

## Global Constraints

- Build stays on webpack (`next dev --webpack` / `next build --webpack`) — Turbopack can't resolve this codebase's `.js`-specifier-pointing-at-`.ts` import convention. `next.config.ts`'s `extensionAlias: { ".js": [".ts", ".tsx", ".js"] }` must survive every task.
- `better-sqlite3` stays in `serverExternalPackages` — never gets bundled.
- Money is always integer piasters internally; EGP↔piaster conversion only at the MCP tool boundary (`lib/mcp/money.ts`) — do not touch this logic, only relocate it.
- MCP endpoint has no auth (local-only, per spec's explicit scope — do not add auth).
- MCP transport is stateless — do not add `sessionIdGenerator`, do not share a transport instance across requests (the SDK throws if you do).
- No business-logic, schema, or UI changes — this plan is a structural move only.
- Total test count must not drop below 76 (50 core + 11 web + 15 mcp today) — new tests can be added, existing ones only relocated, never deleted without a replacement.

---

### Task 1: Merge `packages/core` and `apps/mcp` into `apps/web`

**Files:**
- Move: `packages/core/src/**` → `apps/web/lib/core/**`
- Move: `packages/core/test/**` → `apps/web/test/core/**`
- Move: `packages/core/scripts/demo.ts` → `apps/web/scripts/demo.ts`
- Move: `apps/mcp/src/tools.ts` → `apps/web/lib/mcp/tools.ts`
- Move: `apps/mcp/src/money.ts` → `apps/web/lib/mcp/money.ts`
- Move: `apps/mcp/src/server.ts` → `apps/web/lib/mcp/server.ts`
- Move: `apps/mcp/test/tools.read.test.ts`, `tools.write.test.ts`, `tools.fixes.test.ts`, `money.test.ts`, `server.test.ts` → `apps/web/test/mcp/*.test.ts`
- Delete: `apps/mcp/src/db.ts`, `apps/mcp/src/index.ts` (no longer needed — `lib/db.ts`'s existing singleton replaces `db.ts`; the stdio connector in `index.ts` has no replacement because Task 2 replaces it with the HTTP route)
- Delete (whole dirs, after the moves above): `packages/core/`, `apps/mcp/`
- Modify: `apps/web/package.json`, `apps/web/next.config.ts`

**Interfaces:**
- Produces: `lib/core/index.ts` re-exports everything `packages/core/src/index.ts` did (same names: `openDb`, `DB`, `migrate`, repository functions, `deriveHoldings`, `getPortfolioSummary`, `evaluateAlerts`, `buildDigest`, `EodhdClient`, `syncPrices`). Later tasks and existing `apps/web` code (`lib/data.ts`, `lib/db.ts`, etc.) that already import these names keep working once their import specifier changes from `"@egx/core"` to a relative path into `lib/core`.
- Produces: `lib/mcp/tools.ts` exports `tools: McpTool[]` and `McpTool`/`defineTool`, unchanged from today. `lib/mcp/server.ts` exports `createServer(): McpServer`, unchanged from today except its import of `getDb`.
- Consumes: `lib/db.ts`'s existing `getDb(): DB` (already in `apps/web/lib/db.ts`, untouched by this task).

- [ ] **Step 1: Move core's source and tests**

```bash
git mv packages/core/src apps/web/lib/core
git mv packages/core/test apps/web/test/core
```

- [ ] **Step 2: Fix import paths in the moved core tests**

Every test in `apps/web/test/core/` imports its subject with `../src/...`. Moved two directories deeper (`test/core/` instead of `test/`), the correct relative path is `../../lib/core/...`:

```bash
sed -i '' 's#\.\./src/#../../lib/core/#g' apps/web/test/core/*.test.ts
```

- [ ] **Step 3: Verify the sed worked and nothing still points at `../src/`**

```bash
grep -rn '\.\./src/' apps/web/test/core/ || echo "clean"
```
Expected: `clean`

- [ ] **Step 3b: Move the core demo script and fix its import**

```bash
mkdir -p apps/web/scripts
git mv packages/core/scripts/demo.ts apps/web/scripts/demo.ts
sed -i '' 's#from "../src/index.js"#from "../lib/core/index.js"#' apps/web/scripts/demo.ts
grep -n '^import\|from "' apps/web/scripts/demo.ts | head -15
```
Expected: the import block now reads `from "../lib/core/index.js"`.

- [ ] **Step 4: Move MCP's tool/money/server source and tests, drop db.ts and index.ts**

```bash
mkdir -p apps/web/lib/mcp apps/web/test/mcp
git mv apps/mcp/src/tools.ts apps/web/lib/mcp/tools.ts
git mv apps/mcp/src/money.ts apps/web/lib/mcp/money.ts
git mv apps/mcp/src/server.ts apps/web/lib/mcp/server.ts
git mv apps/mcp/test/tools.read.test.ts apps/web/test/mcp/tools.read.test.ts
git mv apps/mcp/test/tools.write.test.ts apps/web/test/mcp/tools.write.test.ts
git mv apps/mcp/test/tools.fixes.test.ts apps/web/test/mcp/tools.fixes.test.ts
git mv apps/mcp/test/money.test.ts apps/web/test/mcp/money.test.ts
git mv apps/mcp/test/server.test.ts apps/web/test/mcp/server.test.ts
git rm apps/mcp/src/db.ts apps/mcp/src/index.ts
```

- [ ] **Step 5: Fix import paths in the moved MCP source**

`lib/mcp/tools.ts` imports `@egx/core` — point it at the new relative location. `lib/mcp/server.ts` imports `./db.js` (the old `apps/mcp/src/db.ts`, now deleted) — point it at `lib/db.ts` instead, one directory up:

```bash
sed -i '' 's#from "@egx/core"#from "../core/index.js"#' apps/web/lib/mcp/tools.ts
sed -i '' 's#from "./db.js"#from "../db.js"#' apps/web/lib/mcp/server.ts
```

- [ ] **Step 6: Fix import paths in the moved MCP tests**

`apps/web/test/mcp/*.test.ts` import their subject with `../src/...` (now `../../lib/mcp/...`) and three of them (`tools.fixes.test.ts`, `tools.read.test.ts`, `tools.write.test.ts`) also import `@egx/core` directly (now `../../lib/core/index.js`):

```bash
sed -i '' 's#\.\./src/#../../lib/mcp/#g' apps/web/test/mcp/*.test.ts
sed -i '' 's#from "@egx/core"#from "../../lib/core/index.js"#' apps/web/test/mcp/*.test.ts
grep -rn '\.\./src/\|@egx/core' apps/web/test/mcp/ || echo "clean"
```
Expected: `clean`

- [ ] **Step 6b: Fix `@egx/core` imports in the rest of `apps/web`**

The MCP source/tests weren't the only consumers of `@egx/core` — `apps/web`'s own app/lib/component code imported it directly too. Fix each at its own relative depth:

```bash
sed -i '' 's#from "@egx/core"#from "../lib/core/index.js"#' apps/web/app/actions.ts
sed -i '' 's#from "@egx/core"#from "../../lib/core/index.js"#' apps/web/app/transactions/actions.ts apps/web/app/watchlist/actions.ts
sed -i '' 's#from "@egx/core"#from "./core/index.js"#' apps/web/lib/ticker.ts apps/web/lib/data.ts apps/web/lib/metrics.ts apps/web/lib/db.ts
sed -i '' 's#from "@egx/core"#from "../lib/core/index.js"#' apps/web/components/TickerChartStats.tsx
sed -i '' 's#@egx/core#lib/core#g' apps/web/scripts/demo.ts
grep -rn '@egx/core' apps/web --include='*.ts' --include='*.tsx' || echo "clean"
```
Expected: `clean`. (`scripts/demo.ts`'s two matches are doc-comment mentions, not imports — the sed just keeps the prose accurate.)

- [ ] **Step 7: Delete the now-empty source directories**

```bash
rm -rf packages/core apps/mcp
```

- [ ] **Step 8: Update `apps/web/package.json` — drop `@egx/core`, add the MCP SDK + zod**

Edit `apps/web/package.json`'s `dependencies` block from:
```json
  "dependencies": {
    "@egx/core": "workspace:*",
    "better-sqlite3": "^11.0.0",
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "server-only": "^0.0.1"
  },
```
to:
```json
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "better-sqlite3": "^11.0.0",
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "server-only": "^0.0.1",
    "zod": "^3.23.0"
  },
```

- [ ] **Step 9: Update `apps/web/next.config.ts` — drop the now-meaningless `transpilePackages`**

Edit `apps/web/next.config.ts` from:
```ts
import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@egx/core"],
  serverExternalPackages: ["better-sqlite3"],
  // Turbopack (Next's default bundler) can't resolve relative TS imports
  // written with a ".js" specifier (our ESM convention) back to their ".ts"
  // source files, so this app builds on webpack instead (see package.json
  // scripts). This alias is what makes that resolution work under webpack.
  experimental: {
    extensionAlias: { ".js": [".ts", ".tsx", ".js"] },
  },
};

export default config;
```
to:
```ts
import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  // Turbopack (Next's default bundler) can't resolve relative TS imports
  // written with a ".js" specifier (our ESM convention) back to their ".ts"
  // source files, so this app builds on webpack instead (see package.json
  // scripts). This alias is what makes that resolution work under webpack.
  experimental: {
    extensionAlias: { ".js": [".ts", ".tsx", ".js"] },
  },
};

export default config;
```

- [ ] **Step 10: Reinstall and verify**

```bash
pnpm install
pnpm --filter @egx/web typecheck
pnpm --filter @egx/web test
```
Expected: typecheck passes with no errors; test run shows `apps/web`'s existing 11 tests plus the ~50 relocated core tests plus the ~15 relocated mcp tests, all passing (~76 total), zero references to `@egx/core` remaining anywhere in `apps/web`.

**If `test/mcp/server.test.ts` fails with `"This module cannot be imported from a Client Component module..."`:**
that's `server-only` (imported by `lib/db.ts`, now pulled in transitively by `lib/mcp/server.ts` → `getDb`).
`server-only`'s package.json resolves to a no-op via the `"react-server"` export condition, which Next's
webpack sets for server bundles but plain vitest doesn't. Fix by creating `apps/web/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // "server-only" (imported by lib/db.ts) resolves via this export condition
    // to a no-op under Next's webpack build; vitest needs the same condition
    // set explicitly, or the package's default export (which throws) is used.
    conditions: ["react-server"],
  },
});
```
Then re-run `pnpm --filter @egx/web test` — this is the intended, package-defined fix (not a workaround):
it makes vitest resolve the same conditional export Next's bundler already does, rather than weakening
`lib/db.ts`'s client/server boundary guard or duplicating a second unguarded DB module the way the old
`apps/mcp/src/db.ts` did.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "refactor: merge packages/core and apps/mcp into apps/web"
```

---

### Task 2: Add the MCP HTTP route

**Files:**
- Create: `apps/web/app/api/mcp/route.ts`
- Create: `apps/web/test/mcp/route.test.ts`

**Interfaces:**
- Consumes: `createServer(): McpServer` from `lib/mcp/server.ts` (produced in Task 1, unchanged signature).
- Produces: `POST` request handler at `/api/mcp`, following the MCP Streamable HTTP spec. No `GET`/`DELETE` exported — this app never needs the server-initiated SSE push channel (stateless, single local client), and Next.js returns a 405 automatically for unexported methods, which is the correct response for "this server doesn't support that."

**Design note carried from the spec:** the transport is stateless (`sessionIdGenerator: undefined`). The SDK's own source (`WebStandardStreamableHTTPServerTransport.handleRequest`) throws `"Stateless transport cannot be reused across requests. Create a new transport per request."` if you try to reuse one — so both the transport *and* the `McpServer` are constructed fresh inside the handler, not as a module-level singleton. This costs nothing (registering 11 tool closures is microseconds) and sidesteps a real correctness hazard: a shared `McpServer` holds a single mutable `transport` reference set by `connect()`, so two concurrent requests reusing one server could cross-wire their responses.

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/mcp/route.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { POST } from "../../app/api/mcp/route.js";

function mcpRequest(body: unknown): Request {
  return new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/mcp", () => {
  it("responds to initialize with server info", async () => {
    const res = await POST(
      mcpRequest({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "test-client", version: "0.0.0" },
        },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.serverInfo.name).toBe("egx-portfolio");
  });

  it("lists tools including list_positions", async () => {
    const res = await POST(
      mcpRequest({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const names = body.result.tools.map((t: { name: string }) => t.name);
    expect(names).toContain("list_positions");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @egx/web test -- route.test.ts
```
Expected: FAIL — `apps/web/app/api/mcp/route.ts` does not exist yet (module not found).

- [ ] **Step 3: Write the route handler**

Create `apps/web/app/api/mcp/route.ts`. Note: use the relative `../../../lib/mcp/server.js` import,
not the `@/lib/...` alias used elsewhere in `app/` — vitest has no tsconfig-paths plugin configured
(the existing test suite never needed one, since `lib/*.ts` files only ever import each other with
relative specifiers; only `.tsx` page/component files use `@/`), so a `@/` import here would resolve
fine under Next's webpack build but fail to resolve when `route.test.ts` imports this file directly:

```ts
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createServer } from "../../../lib/mcp/server.js";

export async function POST(request: Request): Promise<Response> {
  const server = createServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm --filter @egx/web test -- route.test.ts
```
Expected: PASS — both tests green.

- [ ] **Step 5: Run the full web test suite to confirm no regressions**

```bash
pnpm --filter @egx/web test
```
Expected: all ~78 tests pass (76 from Task 1 + 2 new route tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/api/mcp/route.ts apps/web/test/mcp/route.test.ts
git commit -m "feat: serve MCP over HTTP from app/api/mcp"
```

---

### Task 3: Flatten `apps/web` up to the repo root

**Files:**
- Move: everything under `apps/web/` → repo root (`app/`, `components/`, `lib/`, `test/`, `scripts/`, `next.config.ts`, `next-env.d.ts`, `tsconfig.json`, `.env.example`, `.gitignore`)
- Move (untracked, plain `mv` not `git mv`): `apps/web/data/` → `data/`, `apps/web/.env.local` → `.env.local`
- Modify/Replace: root `package.json`, root `.gitignore`
- Delete: `pnpm-workspace.yaml`, `tsconfig.base.json`, `apps/web/package.json` (superseded by the merged root one), now-empty `apps/` directory

**Interfaces:**
- No code-level interfaces change here — this is a pure directory move. Every relative import inside `lib/`, `app/`, `test/`, `components/` keeps the same relative depth to its siblings (e.g. `lib/mcp/server.ts`'s `../db.js` still resolves to `lib/db.ts`), because the whole subtree moves as one unit. Only imports that crossed the OLD `apps/web` boundary need checking — there are none, since Task 1 already made `apps/web` self-contained.

- [ ] **Step 1: Confirm nothing unexpected is tracked in the untracked-looking paths before moving them**

```bash
git status --short apps/web/data/ apps/web/.env.local
```
Expected: no output (both untracked/ignored, confirmed earlier in design research — if this prints anything, stop and inspect before proceeding).

- [ ] **Step 2: Move apps/web's tracked contents up to the repo root**

```bash
git mv apps/web/app app
git mv apps/web/components components
git mv apps/web/lib lib
git mv apps/web/test test
git mv apps/web/scripts scripts
git mv apps/web/next.config.ts next.config.ts
git mv apps/web/next-env.d.ts next-env.d.ts
git mv apps/web/tsconfig.json tsconfig.json
git mv apps/web/.env.example .env.example
```

- [ ] **Step 3: Move the untracked data dir and env file with plain `mv`**

```bash
mv apps/web/data data
mv apps/web/.env.local .env.local
```

- [ ] **Step 4: Merge `.gitignore`s**

Replace the root `.gitignore` (currently generic monorepo patterns) with the union of both old files:

```
node_modules/
.env
.env.local
.env*.local
*.sqlite
*.sqlite-*
dist/
.next/
/data/
next-env.d.ts
*.tsbuildinfo
.DS_Store
```

- [ ] **Step 5: Replace the root `package.json`**

```json
{
  "name": "egx-portfolio-tracker",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "dev": "next dev --webpack",
    "build": "next build --webpack",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "backup": "node scripts/backup.mjs",
    "demo": "tsx scripts/demo.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "better-sqlite3": "^11.0.0",
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "server-only": "^0.0.1",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.11",
    "@types/node": "^20.14.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

`tsx` is kept as a devDependency solely to run `scripts/demo.ts` (`packages/core`'s old terminal demo, already moved to `apps/web/scripts/demo.ts` in Task 1 Step 3b, arriving at `scripts/demo.ts` once this task's Step 2 moves `apps/web/scripts` up to the root) — it's no longer needed for an MCP stdio entrypoint, since that entrypoint no longer exists.

- [ ] **Step 6: Delete the leftover workspace/package scaffolding**

```bash
git rm pnpm-workspace.yaml tsconfig.base.json apps/web/package.json
rmdir apps/web apps 2>/dev/null || find apps -type d -empty -delete
```

- [ ] **Step 7: Reinstall from scratch (no workspace now) and verify**

```bash
rm -rf node_modules apps/web/node_modules pnpm-lock.yaml
pnpm install
pnpm typecheck
pnpm test
pnpm build
```
Expected: install succeeds with a single top-level `node_modules` (no workspace symlinks); typecheck passes; all ~78 tests pass; production build succeeds.

- [ ] **Step 8: Update README**

Rewrite the `## Architecture` section (currently describes `packages/core` / `apps/web` / `apps/mcp`) to describe the flat layout from this plan's Task 1–3 file moves (`lib/core/`, `lib/mcp/`, `app/api/mcp/route.ts`, everything else at root). Rewrite the `## MCP server (Claude Code)` section's registration command from:
```bash
claude mcp add egx -- pnpm -C /absolute/path/to/EGX --filter @egx/mcp start
```
to:
```bash
claude mcp add --transport http egx http://localhost:3000/api/mcp
```
(with `next start` or `next dev` left running for it to connect to — call this out explicitly, it's the one real behavior change from the stdio-per-session model). Update the "Tests & core demo" section's commands from the `pnpm --filter` / `pnpm -r` forms to plain `pnpm test`, `pnpm typecheck`, `pnpm demo`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: flatten apps/web up to the repo root, delete the workspace"
```

---

### Task 4: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Full test + typecheck + build pass one more time from a clean install**

```bash
pnpm test
pnpm typecheck
pnpm build
```
Expected: all green (this re-confirms Task 3 Step 7 after the README-only changes in Step 8, which touch no code).

- [ ] **Step 2: Start the app, exercise the MCP endpoint and the dashboard, then stop it — one shell session**

Run as a single command block (job control / `$!` PID capture must stay in one shell invocation — it won't survive across separate tool calls):

```bash
pnpm start & PID=$!
sleep 3
echo "--- initialize ---"
curl -s -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"manual-check","version":"0"}}}'
echo "--- tools/call list_positions ---"
curl -s -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_positions","arguments":{}}}'
echo "--- dashboard status ---"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
kill "$PID"
```
Expected: `initialize` returns `result.serverInfo.name: "egx-portfolio"`; `tools/call` returns a `result.content` array (holdings list, possibly empty if the DB has no transactions yet — either way, no `isError: true` and no HTTP error status); dashboard status prints `200`.

- [ ] **Step 3: Register the HTTP MCP server with Claude Code for this project**

```bash
claude mcp add --transport http egx http://localhost:3000/api/mcp
```
(There was no prior `egx` registration in this environment to remove first — confirmed via `claude mcp list` during planning.) Note for the user: this only works while `next start`/`next dev` is running — that's the operational trade-off accepted in the design spec.
