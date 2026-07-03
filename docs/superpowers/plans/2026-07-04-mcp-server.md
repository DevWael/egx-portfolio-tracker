# EGX MCP Server — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A stdio MCP server (`apps/mcp`) exposing `@egx/core` as read + write tools for Claude Code, sharing the web app's SQLite database, with all money in EGP at the tool boundary.

**Architecture:** `db.ts` opens the shared DB; `money.ts` converts EGP↔piasters; `tools.ts` is a typed registry of `(db, args) → result` handlers over core; `server.ts` registers them with `McpServer` over `StdioServerTransport`. Handlers are unit-tested against a temp DB; the transport is a thin shell.

**Tech Stack:** Node 20+, TypeScript 5, `@modelcontextprotocol/sdk` ^1.12, `zod` ^3.23, `@egx/core` (workspace), tsx, vitest.

## Global Constraints

- **Money is EGP at the tool boundary** (JS numbers, e.g. `84.15`); convert to/from integer **piasters** internally via `money.ts` (`toPiasters = Math.round(egp*100)`, `toEgp = piasters/100`). Piasters never cross the boundary. Percentages are decimal fractions.
- **Shared DB:** `process.env.EGX_DB_PATH` ?? `apps/web/data/egx.db` (resolved relative to the package). Open via core's `openDb` + `migrate`.
- Dates `'YYYY-MM-DD'`; tickers `CODE.EGX`.
- **MCP SDK v1.x**: `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"`, `import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"`. Register tools with `server.registerTool(name, { description, inputSchema }, handler)` where `inputSchema` is a **Zod raw shape** (`{ field: z.string() }`, not `z.object(...)`). Tool handlers return `{ content: [{ type: "text", text }] }`, or `{ ..., isError: true }` on failure.
- Run with `tsx` (no build; core is TS source). ESM (`"type": "module"`), `.js` import specifiers on relative imports. Conventional Commits; NO AI attribution.
- Core exports used (import from `@egx/core`): `openDb`, `migrate`, `DB`, `getSecurity`, `upsertSecurity`, `listSecurities`, `addTransaction`, `listTransactions`, `deleteTransaction`, `getPriceHistory`, `getPortfolioSummary`, `listAlerts`, `addAlert`, `evaluateAlerts`, `EodhdClient`, `syncPrices`, and types `HoldingValuation`, `Transaction`, `Alert`, `PriceBar`, `TriggeredAlert`.

---

### Task 1: Scaffold `@egx/mcp` + shared DB + money helpers

**Files:**
- Create: `apps/mcp/package.json`, `apps/mcp/tsconfig.json`, `apps/mcp/vitest.config.ts`
- Create: `apps/mcp/src/money.ts`, `apps/mcp/src/db.ts`
- Test: `apps/mcp/test/money.test.ts`

**Interfaces:**
- Produces: `toPiasters(egp: number): number`, `toEgp(piasters: number): number` (`money.ts`); `getDb(): DB` (`db.ts`, shared file, migrated, cached).

- [ ] **Step 1: Package + config**

`apps/mcp/package.json`:
```json
{
  "name": "@egx/mcp",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": { "egx-mcp": "src/index.ts" },
  "scripts": {
    "start": "tsx src/index.ts",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@egx/core": "workspace:*",
    "@modelcontextprotocol/sdk": "^1.12.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "tsx": "^4.19.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

`apps/mcp/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "module": "ESNext", "moduleResolution": "Bundler", "noEmit": true, "types": ["node"] },
  "include": ["src", "test"]
}
```

`apps/mcp/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node", include: ["test/**/*.test.ts"] } });
```

- [ ] **Step 2: money.ts**

`apps/mcp/src/money.ts`:
```ts
/** EGP number -> integer piasters. */
export function toPiasters(egp: number): number {
  return Math.round(egp * 100);
}
/** integer piasters -> EGP number. */
export function toEgp(piasters: number | null): number | null {
  return piasters === null ? null : piasters / 100;
}
```

- [ ] **Step 3: db.ts (shared DB)**

`apps/mcp/src/db.ts`:
```ts
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { openDb, migrate, type DB } from "@egx/core";

const DEFAULT_PATH = fileURLToPath(new URL("../../web/data/egx.db", import.meta.url));
const dbPath = process.env.EGX_DB_PATH ?? DEFAULT_PATH;

let db: DB | undefined;
export function getDb(): DB {
  if (!db) {
    mkdirSync(dirname(dbPath), { recursive: true });
    db = openDb(dbPath);
    migrate(db);
  }
  return db;
}
```

- [ ] **Step 4: money test**

`apps/mcp/test/money.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { toPiasters, toEgp } from "../src/money.js";

describe("money", () => {
  it("EGP -> piasters (rounded integer)", () => {
    expect(toPiasters(84.15)).toBe(8415);
    expect(toPiasters(5.1)).toBe(510);
  });
  it("piasters -> EGP, null passthrough", () => {
    expect(toEgp(8415)).toBe(84.15);
    expect(toEgp(null)).toBeNull();
  });
  it("round-trips", () => {
    expect(toEgp(toPiasters(149.06))).toBeCloseTo(149.06, 6);
  });
});
```

- [ ] **Step 5: Install, test**

Run: `pnpm install && pnpm --filter @egx/mcp test`
Expected: money tests pass. If a native build was skipped, `pnpm install --force`.

- [ ] **Step 6: Commit**

```bash
git add apps/mcp/package.json apps/mcp/tsconfig.json apps/mcp/vitest.config.ts apps/mcp/src/money.ts apps/mcp/src/db.ts apps/mcp/test/money.test.ts pnpm-lock.yaml
git commit -m "feat(mcp): scaffold @egx/mcp with shared db and EGP/piaster helpers"
```

---

### Task 2: Read tools

**Files:**
- Create: `apps/mcp/src/tools.ts`
- Test: `apps/mcp/test/tools.read.test.ts`

**Interfaces:**
- Consumes: `getDb` (Task 1), `toEgp`/`toPiasters` (Task 1), core reads.
- Produces:
  - `interface McpTool { name: string; description: string; inputSchema: z.ZodRawShape; handler: (db: DB, args: any) => unknown | Promise<unknown>; }`
  - `function defineTool<S extends z.ZodRawShape>(t: { name: string; description: string; inputSchema: S; handler: (db: DB, args: z.infer<z.ZodObject<S>>) => unknown | Promise<unknown> }): McpTool`
  - `const tools: McpTool[]` containing the read tools (write tools appended in Task 3).

- [ ] **Step 1: Write the failing test**

`apps/mcp/test/tools.read.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { openDb, migrate, upsertSecurity, addTransaction, upsertPrice, addAlert, type DB } from "@egx/core";
import { tools } from "../src/tools.js";

const tool = (name: string) => tools.find((t) => t.name === name)!;
let db: DB;
beforeEach(() => {
  db = openDb(":memory:");
  migrate(db);
  upsertSecurity(db, { ticker: "COMI.EGX", name: "CIB", sector: "Banks", currency: "EGP" });
  addTransaction(db, { ticker: "COMI.EGX", side: "buy", qty: 100, price: 7000, tradedAt: "2026-06-01" }); // 70.00 EGP
  upsertPrice(db, { ticker: "COMI.EGX", date: "2026-07-02", open: 8415, high: 8415, low: 8415, close: 8415, volume: 1000, source: "test" });
  addAlert(db, { ticker: "COMI.EGX", targetPrice: 8000, direction: "above", note: "tp" }); // 80.00
});

describe("read tools", () => {
  it("list_positions returns holdings in EGP", async () => {
    const res: any = await tool("list_positions").handler(db, {});
    expect(res[0]).toMatchObject({ ticker: "COMI.EGX", qty: 100, avgCost: 70, lastClose: 84.15 });
    expect(res[0].marketValue).toBeCloseTo(8415, 2); // 100 * 84.15
  });
  it("get_portfolio_summary totals in EGP", async () => {
    const s: any = await tool("get_portfolio_summary").handler(db, {});
    expect(s.totalMarketValue).toBeCloseTo(8415, 2);
    expect(s.totalCostBasis).toBeCloseTo(7000, 2);
    expect(s.positions).toBe(1);
    expect(s.asOf).toBe("2026-07-02");
  });
  it("list_transactions returns prices in EGP", async () => {
    const t: any = await tool("list_transactions").handler(db, { ticker: "COMI.EGX" });
    expect(t[0]).toMatchObject({ side: "buy", qty: 100, price: 70 });
  });
  it("get_price_history returns OHLC in EGP", async () => {
    const h: any = await tool("get_price_history").handler(db, { ticker: "COMI.EGX", from: "2026-01-01", to: "2026-12-31" });
    expect(h[0]).toMatchObject({ date: "2026-07-02", close: 84.15 });
  });
  it("list_watchlist evaluates and shows the crossed alert", async () => {
    const a: any = await tool("list_watchlist").handler(db, {});
    expect(a[0]).toMatchObject({ ticker: "COMI.EGX", targetPrice: 80, direction: "above" });
    expect(a[0].triggeredAt).toBe("2026-07-02"); // 84.15 >= 80
  });
  it("get_triggered_alerts lists crossed alerts", async () => {
    const t: any = await tool("get_triggered_alerts").handler(db, {});
    expect(t).toHaveLength(1);
    expect(t[0].ticker).toBe("COMI.EGX");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @egx/mcp test tools.read`
Expected: FAIL — module `../src/tools.js` not found.

- [ ] **Step 3: Implement `tools.ts` (read tools)**

`apps/mcp/src/tools.ts`:
```ts
import { z } from "zod";
import {
  type DB,
  getPortfolioSummary, listSecurities, listTransactions, getPriceHistory,
  listAlerts, evaluateAlerts,
} from "@egx/core";
import { toEgp } from "./money.js";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: z.ZodRawShape;
  handler: (db: DB, args: any) => unknown | Promise<unknown>;
}

export function defineTool<S extends z.ZodRawShape>(t: {
  name: string;
  description: string;
  inputSchema: S;
  handler: (db: DB, args: z.infer<z.ZodObject<S>>) => unknown | Promise<unknown>;
}): McpTool {
  return t as unknown as McpTool;
}

const TODAY = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

export const tools: McpTool[] = [
  defineTool({
    name: "list_positions",
    description: "Current holdings with quantity, average cost, last close, market value and unrealized P&L (all in EGP).",
    inputSchema: {},
    handler: (db) => {
      const secs = new Map(listSecurities(db).map((s) => [s.ticker, s]));
      const s = getPortfolioSummary(db);
      return s.holdings.map((h) => ({
        ticker: h.ticker,
        name: secs.get(h.ticker)?.name ?? null,
        sector: secs.get(h.ticker)?.sector ?? null,
        qty: h.qty,
        avgCost: toEgp(h.avgCost),
        lastClose: toEgp(h.lastClose),
        marketValue: toEgp(h.marketValue),
        unrealizedPnl: toEgp(h.unrealizedPnl),
        unrealizedPnlPct: h.unrealizedPnlPct,
        asOf: s.asOf,
      }));
    },
  }),
  defineTool({
    name: "get_portfolio_summary",
    description: "Portfolio totals in EGP: market value, cost basis, unrealized and realized P&L, position count, and the 'prices as of' date.",
    inputSchema: {},
    handler: (db) => {
      const s = getPortfolioSummary(db);
      return {
        totalMarketValue: toEgp(s.totalMarketValue),
        totalCostBasis: toEgp(s.totalCostBasis),
        totalUnrealizedPnl: toEgp(s.totalUnrealizedPnl),
        totalUnrealizedPnlPct: s.totalUnrealizedPnlPct,
        totalRealizedPnl: toEgp(s.totalRealizedPnl),
        positions: s.holdings.length,
        asOf: s.asOf,
      };
    },
  }),
  defineTool({
    name: "list_transactions",
    description: "Transaction ledger (buys/sells), optionally filtered by ticker. Prices and fees in EGP.",
    inputSchema: { ticker: z.string().optional() },
    handler: (db, { ticker }) =>
      listTransactions(db, ticker).map((t) => ({
        id: t.id, ticker: t.ticker, side: t.side, qty: t.qty,
        price: toEgp(t.price), fee: toEgp(t.fee), tradedAt: t.tradedAt, note: t.note,
      })),
  }),
  defineTool({
    name: "get_price_history",
    description: "Daily OHLCV price history for a ticker (EGP). Defaults to the last 365 days.",
    inputSchema: { ticker: z.string(), from: z.string().optional(), to: z.string().optional() },
    handler: (db, { ticker, from, to }) =>
      getPriceHistory(db, ticker, from ?? daysAgo(365), to ?? TODAY()).map((b) => ({
        date: b.date, open: toEgp(b.open), high: toEgp(b.high), low: toEgp(b.low), close: toEgp(b.close), volume: b.volume,
      })),
  }),
  defineTool({
    name: "list_watchlist",
    description: "Watchlist alerts with current status (evaluated against the latest close). Targets in EGP.",
    inputSchema: {},
    handler: (db) => {
      evaluateAlerts(db); // stamp any newly crossed alerts first
      return listAlerts(db).map((a) => ({
        id: a.id, ticker: a.ticker, targetPrice: toEgp(a.targetPrice),
        direction: a.direction, active: a.active, note: a.note, triggeredAt: a.triggeredAt,
      }));
    },
  }),
  defineTool({
    name: "get_triggered_alerts",
    description: "Alerts crossed at the latest close (ticker, direction, target and the close that crossed it, in EGP).",
    inputSchema: {},
    handler: (db) =>
      evaluateAlerts(db).map((t) => ({
        ticker: t.alert.ticker, direction: t.alert.direction,
        targetPrice: toEgp(t.alert.targetPrice), lastClose: toEgp(t.lastClose), lastCloseDate: t.lastCloseDate,
      })),
  }),
];
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @egx/mcp test tools.read && pnpm --filter @egx/mcp typecheck`
Expected: read-tool tests PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add apps/mcp/src/tools.ts apps/mcp/test/tools.read.test.ts
git commit -m "feat(mcp): read tools (positions, summary, transactions, price history, watchlist)"
```

---

### Task 3: Write tools

**Files:**
- Modify: `apps/mcp/src/tools.ts` (append write tools to the `tools` array + new imports)
- Test: `apps/mcp/test/tools.write.test.ts`

**Interfaces:**
- Consumes: `getSecurity`, `upsertSecurity`, `addTransaction`, `deleteTransaction`, `addAlert`, `EodhdClient`, `syncPrices`, `listTransactions`, `listAlerts` from core; `toPiasters` from `money.ts`.
- Produces: appended tools `record_transaction`, `delete_transaction`, `set_alert`, `upsert_security`, `refresh_prices`.

- [ ] **Step 1: Write the failing test**

`apps/mcp/test/tools.write.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { openDb, migrate, listTransactions, listAlerts, getSecurity, type DB } from "@egx/core";
import { tools } from "../src/tools.js";

const tool = (name: string) => tools.find((t) => t.name === name)!;
let db: DB;
beforeEach(() => { db = openDb(":memory:"); migrate(db); });

describe("write tools", () => {
  it("record_transaction stores EGP price as piasters and reflects in summary", async () => {
    await tool("record_transaction").handler(db, { ticker: "COMI.EGX", side: "buy", qty: 100, price: 84.15, tradedAt: "2026-06-01" });
    const tx = listTransactions(db, "COMI.EGX");
    expect(tx).toHaveLength(1);
    expect(tx[0].price).toBe(8415); // stored as piasters
    expect(getSecurity(db, "COMI.EGX")).not.toBeNull(); // security auto-created
  });
  it("record_transaction keeps an existing security's name", async () => {
    await tool("upsert_security").handler(db, { ticker: "COMI.EGX", name: "Commercial International Bank", sector: "Banks" });
    await tool("record_transaction").handler(db, { ticker: "COMI.EGX", side: "buy", qty: 1, price: 84 });
    expect(getSecurity(db, "COMI.EGX")!.name).toBe("Commercial International Bank");
  });
  it("delete_transaction removes it", async () => {
    await tool("record_transaction").handler(db, { ticker: "COMI.EGX", side: "buy", qty: 1, price: 84 });
    const id = listTransactions(db)[0].id;
    await tool("delete_transaction").handler(db, { id });
    expect(listTransactions(db)).toHaveLength(0);
  });
  it("set_alert stores target in piasters", async () => {
    await tool("set_alert").handler(db, { ticker: "COMI.EGX", targetPrice: 80, direction: "above" });
    expect(listAlerts(db)[0].targetPrice).toBe(8000);
  });
  it("refresh_prices without an API key returns a message and does not throw", async () => {
    delete process.env.EODHD_API_KEY;
    const r: any = await tool("refresh_prices").handler(db, {});
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/EODHD_API_KEY/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @egx/mcp test tools.write`
Expected: FAIL — write tools not defined (find returns undefined).

- [ ] **Step 3: Implement (append write tools + imports)**

In `apps/mcp/src/tools.ts`, extend the core import to add the write functions and `toPiasters`:
```ts
import {
  type DB,
  getPortfolioSummary, listSecurities, listTransactions, getPriceHistory,
  listAlerts, evaluateAlerts,
  getSecurity, upsertSecurity, addTransaction, deleteTransaction, addAlert,
  EodhdClient, syncPrices,
} from "@egx/core";
import { toEgp, toPiasters } from "./money.js";
```
Then append these entries to the `tools` array (before the closing `];`):
```ts
  defineTool({
    name: "record_transaction",
    description: "Record a buy or sell. Price and fee are in EGP. Auto-creates the security if unknown (name defaults to the ticker; use upsert_security to set a real name).",
    inputSchema: {
      ticker: z.string(),
      side: z.enum(["buy", "sell"]),
      qty: z.number().int().positive(),
      price: z.number().nonnegative(),
      fee: z.number().nonnegative().optional(),
      tradedAt: z.string().optional(),
      note: z.string().optional(),
    },
    handler: (db, a) => {
      if (!getSecurity(db, a.ticker)) upsertSecurity(db, { ticker: a.ticker, name: a.ticker, sector: null, currency: "EGP" });
      const tx = addTransaction(db, {
        ticker: a.ticker, side: a.side, qty: a.qty,
        price: toPiasters(a.price), fee: toPiasters(a.fee ?? 0), tradedAt: a.tradedAt, note: a.note ?? null,
      });
      return { ok: true, transaction: { ...tx, price: toEgp(tx.price), fee: toEgp(tx.fee) } };
    },
  }),
  defineTool({
    name: "delete_transaction",
    description: "Delete a transaction by id.",
    inputSchema: { id: z.number().int() },
    handler: (db, { id }) => { deleteTransaction(db, id); return { ok: true }; },
  }),
  defineTool({
    name: "set_alert",
    description: "Add a price-target alert. Target in EGP; direction 'above' or 'below'. Auto-creates the security if unknown.",
    inputSchema: {
      ticker: z.string(),
      targetPrice: z.number().positive(),
      direction: z.enum(["above", "below"]),
      note: z.string().optional(),
    },
    handler: (db, a) => {
      if (!getSecurity(db, a.ticker)) upsertSecurity(db, { ticker: a.ticker, name: a.ticker, sector: null, currency: "EGP" });
      const alert = addAlert(db, { ticker: a.ticker, targetPrice: toPiasters(a.targetPrice), direction: a.direction, note: a.note ?? null });
      return { ok: true, alert: { ...alert, targetPrice: toEgp(alert.targetPrice) } };
    },
  }),
  defineTool({
    name: "upsert_security",
    description: "Create or update a security's name and sector.",
    inputSchema: { ticker: z.string(), name: z.string(), sector: z.string().optional() },
    handler: (db, a) => { upsertSecurity(db, { ticker: a.ticker, name: a.name, sector: a.sector ?? null, currency: "EGP" }); return { ok: true }; },
  }),
  defineTool({
    name: "refresh_prices",
    description: "Fetch end-of-day prices from EODHD for the given tickers (default: all held and watched) over the last 365 days. Requires EODHD_API_KEY.",
    inputSchema: { tickers: z.array(z.string()).optional() },
    handler: async (db, { tickers }) => {
      const key = process.env.EODHD_API_KEY;
      if (!key) return { ok: false, message: "Set EODHD_API_KEY in the environment to fetch live prices." };
      const list = tickers ?? Array.from(new Set([
        ...listTransactions(db).map((t) => t.ticker),
        ...listAlerts(db).map((al) => al.ticker),
      ]));
      if (list.length === 0) return { ok: false, message: "Nothing to refresh — add positions first." };
      const to = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
      const stored = await syncPrices(db, new EodhdClient({ apiKey: key }), list, from, to);
      return { ok: true, stored, tickers: list };
    },
  }),
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @egx/mcp test && pnpm --filter @egx/mcp typecheck`
Expected: all tool tests (read + write) PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add apps/mcp/src/tools.ts apps/mcp/test/tools.write.test.ts
git commit -m "feat(mcp): write tools (record/delete transaction, set alert, upsert security, refresh prices)"
```

---

### Task 4: Server wiring, entrypoint, boot smoke test, README

**Files:**
- Create: `apps/mcp/src/server.ts`, `apps/mcp/src/index.ts`
- Test: `apps/mcp/test/server.test.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: `tools` (Task 2/3), `getDb` (Task 1), MCP SDK.
- Produces: `createServer(): McpServer` (registers all tools); `index.ts` connects stdio.

- [ ] **Step 1: Write the failing test (server registers all tools)**

`apps/mcp/test/server.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createServer } from "../src/server.js";
import { tools } from "../src/tools.js";

describe("server", () => {
  it("builds without throwing and registers every tool", () => {
    const server = createServer();
    expect(server).toBeTruthy();
    // registry sanity: unique names, all read+write tools present
    const names = tools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const n of ["list_positions", "get_portfolio_summary", "record_transaction", "set_alert", "refresh_prices"]) {
      expect(names).toContain(n);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @egx/mcp test server`
Expected: FAIL — `../src/server.js` not found.

- [ ] **Step 3: Implement server.ts + index.ts**

`apps/mcp/src/server.ts`:
```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { tools } from "./tools.js";
import { getDb } from "./db.js";

export function createServer(): McpServer {
  const server = new McpServer({ name: "egx-portfolio", version: "0.1.0" });
  for (const t of tools) {
    server.registerTool(
      t.name,
      { description: t.description, inputSchema: t.inputSchema },
      async (args: unknown) => {
        try {
          const result = await t.handler(getDb(), args ?? {});
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
        } catch (e) {
          return { content: [{ type: "text" as const, text: `Error: ${(e as Error).message}` }], isError: true };
        }
      },
    );
  }
  return server;
}
```

`apps/mcp/src/index.ts`:
```ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

const server = createServer();
await server.connect(new StdioServerTransport());
```

Note: `createServer()` does not touch the DB (tools call `getDb()` lazily on invocation), so the boot test never opens a file. `registerTool`'s `inputSchema` is the Zod raw shape stored on each tool.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @egx/mcp test && pnpm --filter @egx/mcp typecheck`
Expected: all tests PASS (money + read + write + server), typecheck clean.

- [ ] **Step 5: Verify the server actually boots over stdio**

Run (from repo root):
```bash
timeout 5 pnpm --filter @egx/mcp start </dev/null 2>/tmp/egx-mcp.err || true
grep -iE "error|throw|cannot find" /tmp/egx-mcp.err && echo "BOOT ERROR" || echo "boots clean (waits for stdio, no crash)"
```
Expected: "boots clean" — the process starts, waits on stdio, and exits on timeout with no error output. (A stdio MCP server produces no stdout until a client speaks to it.)

- [ ] **Step 6: Add the README "MCP (Claude Code)" section**

Add to `README.md` after the "Live prices" section:
```markdown
## MCP server (Claude Code)

Drive the portfolio by chatting in Claude Code. The MCP server shares the web app's database.

```bash
claude mcp add egx -- pnpm -C /absolute/path/to/EGX --filter @egx/mcp start
```

Set `EODHD_API_KEY` (for `refresh_prices`) and optionally `EGX_DB_PATH` in the environment Claude Code launches with. Then ask things like *"how's my portfolio?"*, *"record a buy of 100 COMI.EGX at 84.15"*, or *"any alerts crossed?"* — tools speak **EGP**. Available tools: `list_positions`, `get_portfolio_summary`, `list_transactions`, `get_price_history`, `list_watchlist`, `get_triggered_alerts`, `record_transaction`, `delete_transaction`, `set_alert`, `upsert_security`, `refresh_prices`.
```

Update the Status table row for `apps/mcp` from ⏳ Planned to ✅ Complete.

- [ ] **Step 7: Commit**

```bash
git add apps/mcp/src/server.ts apps/mcp/src/index.ts apps/mcp/test/server.test.ts README.md
git commit -m "feat(mcp): stdio server wiring, entrypoint, boot test, and README registration"
```

---

## Self-Review

**Spec coverage:**
- stdio MCP server over `@egx/core` → Tasks 1–4. ✓
- Shared DB (EGX_DB_PATH ?? apps/web/data/egx.db) via openDb+migrate → Task 1 `db.ts`. ✓
- EGP↔piaster boundary centralized → Task 1 `money.ts`, used in every tool. ✓
- Read tools (positions, summary, transactions, price history, watchlist evaluates-first, triggered alerts) → Task 2. ✓
- Write tools (record/delete transaction, set alert, upsert security, refresh prices w/ key guard + graceful) → Task 3. ✓
- Tools return JSON text content; errors → isError with plain message → Task 4 `server.ts`. ✓
- Registration (tsx start + `claude mcp add`) + README → Task 4. ✓
- Testing: handlers unit-tested vs temp DB (EGP round-trip, record→summary, alert set/trigger, refresh missing-key), server boot smoke → Tasks 1–4. ✓
- Intelligence stays in Claude Code (no LLM in server) → server is data-only by construction. ✓

**Placeholder scan:** No TBD/TODO; every step has complete code.

**Type consistency:** `McpTool`/`defineTool` defined in Task 2 and reused in Tasks 3–4; `tools` array extended in Task 3 with the same shape; `getDb`/`toEgp`/`toPiasters` signatures match Task 1; core function names match `@egx/core`'s exports (per Global Constraints). `registerTool(name, { description, inputSchema }, handler)` and stdio imports match the SDK v1.x API.

**Deferred (per spec):** HTTP/SSE transport, resources/prompts, derived-stats tools, news/fundamentals, auth.
