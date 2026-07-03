# EGX Tracker — Core Package Implementation Plan (Plan 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `packages/core` brain — SQLite data layer, repositories, portfolio math, alert evaluation, daily digest, and EODHD client — fully unit-tested, with zero UI or MCP knowledge.

**Architecture:** TypeScript pnpm-workspace monorepo. `packages/core` owns all logic and data access; later plans add thin `apps/mcp` and `apps/web` shells over it. Transactions are the source of truth; holdings are derived. All money is stored and computed as **integer piasters** (1 EGP = 100 piasters) to avoid float drift.

**Tech Stack:** Node 20+, TypeScript 5, pnpm 9 workspaces, better-sqlite3 (synchronous SQLite, WAL mode), vitest 2, native `fetch` for EODHD.

## Global Constraints

- **Node** ≥ 20 (native `fetch`, better-sqlite3 support). **pnpm** ≥ 9. **TypeScript** 5.x. **vitest** 2.x.
- **Money:** integer **piasters** everywhere (1 EGP = 100 piasters). Never store or compute money as floating point. Convert to/from EGP only at display boundaries (not in core).
- **Dates:** ISO date strings `'YYYY-MM-DD'` (EOD granularity; no time component).
- **Ticker format:** `CODE.EGX` (e.g. `COMI.EGX`).
- **Cost-basis method:** weighted-average cost. Buy fees are added to cost basis; sell fees reduce realized proceeds.
- **Percentages:** decimal fractions (e.g. `0.162` means 16.2%), not pre-multiplied by 100.
- **Secrets:** `EODHD_API_KEY` from env; never hardcode. Test with an injected `fetch`, never a live call.
- **Commit style:** Conventional Commits. No AI attribution in commit messages.

---

### Task 1: Monorepo scaffold + core package skeleton

**Files:**
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json` (root)
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/vitest.config.ts`
- Create: `packages/core/src/index.ts`
- Test: `packages/core/test/smoke.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a working `pnpm --filter @egx/core test` command and the `@egx/core` package name that all later tasks import from.

- [ ] **Step 1: Create root workspace files**

`pnpm-workspace.yaml`:
```yaml
packages:
  - "packages/*"
  - "apps/*"
```

Root `package.json`:
```json
{
  "name": "egx-portfolio-tracker",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck"
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "resolveJsonModule": true,
    "types": ["node"]
  }
}
```

- [ ] **Step 2: Create the core package files**

`packages/core/package.json`:
```json
{
  "name": "@egx/core",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.11",
    "@types/node": "^20.14.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

`packages/core/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src", "test"]
}
```

`packages/core/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["test/**/*.test.ts"] },
});
```

`packages/core/src/index.ts`:
```ts
export const CORE_VERSION = "0.0.0";
```

- [ ] **Step 3: Write the smoke test**

`packages/core/test/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { CORE_VERSION } from "../src/index.js";

describe("core smoke", () => {
  it("exposes a version", () => {
    expect(CORE_VERSION).toBe("0.0.0");
  });
});
```

- [ ] **Step 4: Install and run**

Run: `pnpm install && pnpm --filter @egx/core test`
Expected: 1 passing test.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold pnpm monorepo and @egx/core skeleton"
```

---

### Task 2: Types + database connection + schema migration

**Files:**
- Create: `packages/core/src/types.ts`
- Create: `packages/core/src/db/schema.sql`
- Create: `packages/core/src/db/connection.ts`
- Create: `packages/core/src/db/migrate.ts`
- Test: `packages/core/test/db.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - All shared types (used by every later task).
  - `openDb(path: string): Database` — opens SQLite, sets `journal_mode=WAL` and `foreign_keys=ON`.
  - `migrate(db: Database): void` — creates all tables (idempotent).

- [ ] **Step 1: Create the shared types**

`packages/core/src/types.ts`:
```ts
/** Integer minor units of EGP. 1 EGP = 100 piasters. */
export type Piasters = number;

export type Side = "buy" | "sell";
export type AlertDirection = "above" | "below";

export interface Security {
  ticker: string; // e.g. "COMI.EGX"
  name: string;
  sector: string | null;
  currency: string; // "EGP"
}

export interface Transaction {
  id: number;
  ticker: string;
  side: Side;
  qty: number; // integer shares
  price: Piasters; // per share
  fee: Piasters;
  tradedAt: string; // "YYYY-MM-DD"
  note: string | null;
}

export interface NewTransaction {
  ticker: string;
  side: Side;
  qty: number;
  price: Piasters;
  fee?: Piasters; // default 0
  tradedAt?: string; // default today
  note?: string | null;
}

export interface PriceBar {
  ticker: string;
  date: string; // "YYYY-MM-DD"
  open: Piasters;
  high: Piasters;
  low: Piasters;
  close: Piasters;
  volume: number;
  source: string; // "eodhd"
}

export interface Holding {
  ticker: string;
  qty: number; // net shares held (>= 0)
  avgCost: Piasters; // weighted avg cost per remaining share
  costBasis: Piasters; // total cost of remaining shares
  realizedPnl: Piasters; // realized from sells to date
}

export interface HoldingValuation extends Holding {
  lastClose: Piasters | null;
  lastCloseDate: string | null;
  marketValue: Piasters | null;
  unrealizedPnl: Piasters | null;
  unrealizedPnlPct: number | null; // decimal fraction
}

export interface PortfolioSummary {
  asOf: string | null; // latest price date across holdings
  totalMarketValue: Piasters;
  totalCostBasis: Piasters;
  totalUnrealizedPnl: Piasters;
  totalUnrealizedPnlPct: number; // decimal fraction
  totalRealizedPnl: Piasters;
  holdings: HoldingValuation[];
}

export interface Alert {
  id: number;
  ticker: string;
  targetPrice: Piasters;
  direction: AlertDirection;
  active: boolean;
  note: string | null;
  createdAt: string;
  triggeredAt: string | null;
}

export interface NewAlert {
  ticker: string;
  targetPrice: Piasters;
  direction: AlertDirection;
  note?: string | null;
}

export interface TriggeredAlert {
  alert: Alert;
  lastClose: Piasters;
  lastCloseDate: string;
}
```

- [ ] **Step 2: Create the schema SQL**

`packages/core/src/db/schema.sql`:
```sql
CREATE TABLE IF NOT EXISTS securities (
  ticker   TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  sector   TEXT,
  currency TEXT NOT NULL DEFAULT 'EGP'
);

CREATE TABLE IF NOT EXISTS transactions (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker    TEXT NOT NULL REFERENCES securities(ticker),
  side      TEXT NOT NULL CHECK (side IN ('buy','sell')),
  qty       INTEGER NOT NULL,
  price     INTEGER NOT NULL,
  fee       INTEGER NOT NULL DEFAULT 0,
  traded_at TEXT NOT NULL,
  note      TEXT
);

CREATE TABLE IF NOT EXISTS prices (
  ticker TEXT NOT NULL REFERENCES securities(ticker),
  date   TEXT NOT NULL,
  open   INTEGER NOT NULL,
  high   INTEGER NOT NULL,
  low    INTEGER NOT NULL,
  close  INTEGER NOT NULL,
  volume INTEGER NOT NULL,
  source TEXT NOT NULL,
  PRIMARY KEY (ticker, date)
);

CREATE TABLE IF NOT EXISTS watchlist_alerts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker       TEXT NOT NULL REFERENCES securities(ticker),
  target_price INTEGER NOT NULL,
  direction    TEXT NOT NULL CHECK (direction IN ('above','below')),
  active       INTEGER NOT NULL DEFAULT 1,
  note         TEXT,
  created_at   TEXT NOT NULL,
  triggered_at TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);
```

- [ ] **Step 3: Write connection + migrate**

`packages/core/src/db/connection.ts`:
```ts
import Database from "better-sqlite3";

export type DB = Database.Database;

export function openDb(path: string): DB {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}
```

`packages/core/src/db/migrate.ts`:
```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { DB } from "./connection.js";

const here = dirname(fileURLToPath(import.meta.url));

export function migrate(db: DB): void {
  const sql = readFileSync(join(here, "schema.sql"), "utf8");
  db.exec(sql);
}
```

- [ ] **Step 4: Write the failing test**

`packages/core/test/db.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { openDb } from "../src/db/connection.js";
import { migrate } from "../src/db/migrate.js";

describe("db migration", () => {
  it("creates all tables in an in-memory db", () => {
    const db = openDb(":memory:");
    migrate(db);
    const rows = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const names = rows.map((r) => r.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "securities",
        "transactions",
        "prices",
        "watchlist_alerts",
        "settings",
      ])
    );
  });

  it("is idempotent", () => {
    const db = openDb(":memory:");
    migrate(db);
    expect(() => migrate(db)).not.toThrow();
  });
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @egx/core test`
Expected: db tests PASS.
Note: `schema.sql` is read at runtime; ensure vitest resolves it relative to `src/db/`. It does because `migrate.ts` uses `import.meta.url`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(core): add shared types, sqlite schema, connection and migration"
```

---

### Task 3: Securities repository

**Files:**
- Create: `packages/core/src/repositories/securities.ts`
- Test: `packages/core/test/securities.repo.test.ts`

**Interfaces:**
- Consumes: `DB` (Task 2), `Security` type (Task 2).
- Produces:
  - `upsertSecurity(db: DB, s: Security): void`
  - `getSecurity(db: DB, ticker: string): Security | null`
  - `listSecurities(db: DB): Security[]`

- [ ] **Step 1: Write the failing test**

`packages/core/test/securities.repo.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { openDb, type DB } from "../src/db/connection.js";
import { migrate } from "../src/db/migrate.js";
import {
  upsertSecurity,
  getSecurity,
  listSecurities,
} from "../src/repositories/securities.js";

let db: DB;
beforeEach(() => {
  db = openDb(":memory:");
  migrate(db);
});

describe("securities repo", () => {
  it("inserts and reads a security", () => {
    upsertSecurity(db, { ticker: "COMI.EGX", name: "CIB", sector: "Banks", currency: "EGP" });
    expect(getSecurity(db, "COMI.EGX")).toEqual({
      ticker: "COMI.EGX", name: "CIB", sector: "Banks", currency: "EGP",
    });
  });

  it("upsert overwrites name and sector", () => {
    upsertSecurity(db, { ticker: "COMI.EGX", name: "CIB", sector: "Banks", currency: "EGP" });
    upsertSecurity(db, { ticker: "COMI.EGX", name: "Commercial Intl Bank", sector: "Financials", currency: "EGP" });
    expect(getSecurity(db, "COMI.EGX")?.name).toBe("Commercial Intl Bank");
    expect(getSecurity(db, "COMI.EGX")?.sector).toBe("Financials");
  });

  it("returns null for unknown ticker", () => {
    expect(getSecurity(db, "NOPE.EGX")).toBeNull();
  });

  it("lists securities sorted by ticker", () => {
    upsertSecurity(db, { ticker: "HRHO.EGX", name: "EFG", sector: "Financials", currency: "EGP" });
    upsertSecurity(db, { ticker: "COMI.EGX", name: "CIB", sector: "Banks", currency: "EGP" });
    expect(listSecurities(db).map((s) => s.ticker)).toEqual(["COMI.EGX", "HRHO.EGX"]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @egx/core test securities.repo`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`packages/core/src/repositories/securities.ts`:
```ts
import type { DB } from "../db/connection.js";
import type { Security } from "../types.js";

export function upsertSecurity(db: DB, s: Security): void {
  db.prepare(
    `INSERT INTO securities (ticker, name, sector, currency)
     VALUES (@ticker, @name, @sector, @currency)
     ON CONFLICT(ticker) DO UPDATE SET
       name = excluded.name,
       sector = excluded.sector,
       currency = excluded.currency`
  ).run(s);
}

export function getSecurity(db: DB, ticker: string): Security | null {
  const row = db
    .prepare(`SELECT ticker, name, sector, currency FROM securities WHERE ticker = ?`)
    .get(ticker) as Security | undefined;
  return row ?? null;
}

export function listSecurities(db: DB): Security[] {
  return db
    .prepare(`SELECT ticker, name, sector, currency FROM securities ORDER BY ticker`)
    .all() as Security[];
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @egx/core test securities.repo`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): add securities repository"
```

---

### Task 4: Transactions repository

**Files:**
- Create: `packages/core/src/repositories/transactions.ts`
- Test: `packages/core/test/transactions.repo.test.ts`

**Interfaces:**
- Consumes: `DB`, `Transaction`, `NewTransaction` (Task 2); securities repo (Task 3) for test setup.
- Produces:
  - `addTransaction(db: DB, t: NewTransaction): Transaction` — fills `fee` (default 0), `tradedAt` (default today `YYYY-MM-DD`), `note` (default null); returns the stored row with its `id`.
  - `listTransactions(db: DB, ticker?: string): Transaction[]` — ordered by `tradedAt` then `id`.
  - `deleteTransaction(db: DB, id: number): void`

- [ ] **Step 1: Write the failing test**

`packages/core/test/transactions.repo.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { openDb, type DB } from "../src/db/connection.js";
import { migrate } from "../src/db/migrate.js";
import { upsertSecurity } from "../src/repositories/securities.js";
import {
  addTransaction,
  listTransactions,
  deleteTransaction,
} from "../src/repositories/transactions.js";

let db: DB;
beforeEach(() => {
  db = openDb(":memory:");
  migrate(db);
  upsertSecurity(db, { ticker: "COMI.EGX", name: "CIB", sector: "Banks", currency: "EGP" });
});

describe("transactions repo", () => {
  it("adds a transaction with defaults and returns id", () => {
    const t = addTransaction(db, {
      ticker: "COMI.EGX", side: "buy", qty: 500, price: 7240, tradedAt: "2026-06-01",
    });
    expect(t.id).toBeGreaterThan(0);
    expect(t.fee).toBe(0);
    expect(t.note).toBeNull();
    expect(t.price).toBe(7240);
  });

  it("defaults tradedAt to today when omitted", () => {
    const t = addTransaction(db, { ticker: "COMI.EGX", side: "buy", qty: 1, price: 100 });
    expect(t.tradedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("lists in tradedAt then id order, filterable by ticker", () => {
    addTransaction(db, { ticker: "COMI.EGX", side: "buy", qty: 1, price: 100, tradedAt: "2026-06-02" });
    addTransaction(db, { ticker: "COMI.EGX", side: "buy", qty: 1, price: 100, tradedAt: "2026-06-01" });
    const dates = listTransactions(db, "COMI.EGX").map((t) => t.tradedAt);
    expect(dates).toEqual(["2026-06-01", "2026-06-02"]);
  });

  it("deletes a transaction", () => {
    const t = addTransaction(db, { ticker: "COMI.EGX", side: "buy", qty: 1, price: 100 });
    deleteTransaction(db, t.id);
    expect(listTransactions(db)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @egx/core test transactions.repo`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`packages/core/src/repositories/transactions.ts`:
```ts
import type { DB } from "../db/connection.js";
import type { Transaction, NewTransaction } from "../types.js";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addTransaction(db: DB, t: NewTransaction): Transaction {
  const row = {
    ticker: t.ticker,
    side: t.side,
    qty: t.qty,
    price: t.price,
    fee: t.fee ?? 0,
    traded_at: t.tradedAt ?? today(),
    note: t.note ?? null,
  };
  const info = db
    .prepare(
      `INSERT INTO transactions (ticker, side, qty, price, fee, traded_at, note)
       VALUES (@ticker, @side, @qty, @price, @fee, @traded_at, @note)`
    )
    .run(row);
  return {
    id: Number(info.lastInsertRowid),
    ticker: row.ticker,
    side: row.side,
    qty: row.qty,
    price: row.price,
    fee: row.fee,
    tradedAt: row.traded_at,
    note: row.note,
  };
}

function mapRow(r: any): Transaction {
  return {
    id: r.id, ticker: r.ticker, side: r.side, qty: r.qty,
    price: r.price, fee: r.fee, tradedAt: r.traded_at, note: r.note,
  };
}

export function listTransactions(db: DB, ticker?: string): Transaction[] {
  const rows = ticker
    ? db.prepare(`SELECT * FROM transactions WHERE ticker = ? ORDER BY traded_at, id`).all(ticker)
    : db.prepare(`SELECT * FROM transactions ORDER BY traded_at, id`).all();
  return (rows as any[]).map(mapRow);
}

export function deleteTransaction(db: DB, id: number): void {
  db.prepare(`DELETE FROM transactions WHERE id = ?`).run(id);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @egx/core test transactions.repo`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): add transactions repository"
```

---

### Task 5: Prices repository

**Files:**
- Create: `packages/core/src/repositories/prices.ts`
- Test: `packages/core/test/prices.repo.test.ts`

**Interfaces:**
- Consumes: `DB`, `PriceBar` (Task 2); securities repo (Task 3) for setup.
- Produces:
  - `upsertPrice(db: DB, bar: PriceBar): void` — upsert on (ticker, date).
  - `upsertPrices(db: DB, bars: PriceBar[]): void` — one transaction.
  - `getLatestPrice(db: DB, ticker: string): PriceBar | null` — most recent date.
  - `getPriceHistory(db: DB, ticker: string, from: string, to: string): PriceBar[]` — inclusive, ascending by date.
  - `getLatestPriceDate(db: DB): string | null` — max date across all prices.

- [ ] **Step 1: Write the failing test**

`packages/core/test/prices.repo.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { openDb, type DB } from "../src/db/connection.js";
import { migrate } from "../src/db/migrate.js";
import { upsertSecurity } from "../src/repositories/securities.js";
import {
  upsertPrice, upsertPrices, getLatestPrice, getPriceHistory, getLatestPriceDate,
} from "../src/repositories/prices.js";
import type { PriceBar } from "../src/types.js";

const bar = (date: string, close: number): PriceBar => ({
  ticker: "COMI.EGX", date, open: close, high: close, low: close, close, volume: 1000, source: "eodhd",
});

let db: DB;
beforeEach(() => {
  db = openDb(":memory:");
  migrate(db);
  upsertSecurity(db, { ticker: "COMI.EGX", name: "CIB", sector: "Banks", currency: "EGP" });
});

describe("prices repo", () => {
  it("upserts and reads latest price", () => {
    upsertPrices(db, [bar("2026-06-01", 8000), bar("2026-06-02", 8415)]);
    expect(getLatestPrice(db, "COMI.EGX")?.close).toBe(8415);
    expect(getLatestPrice(db, "COMI.EGX")?.date).toBe("2026-06-02");
  });

  it("upsert overwrites same (ticker,date)", () => {
    upsertPrice(db, bar("2026-06-02", 8000));
    upsertPrice(db, bar("2026-06-02", 8415));
    expect(getLatestPrice(db, "COMI.EGX")?.close).toBe(8415);
  });

  it("returns null latest for unknown ticker", () => {
    expect(getLatestPrice(db, "NOPE.EGX")).toBeNull();
  });

  it("returns inclusive ascending history", () => {
    upsertPrices(db, [bar("2026-06-01", 100), bar("2026-06-02", 200), bar("2026-06-03", 300)]);
    const h = getPriceHistory(db, "COMI.EGX", "2026-06-01", "2026-06-02");
    expect(h.map((b) => b.date)).toEqual(["2026-06-01", "2026-06-02"]);
  });

  it("reports latest price date across all tickers", () => {
    upsertPrices(db, [bar("2026-06-01", 100), bar("2026-06-03", 300)]);
    expect(getLatestPriceDate(db)).toBe("2026-06-03");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @egx/core test prices.repo`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`packages/core/src/repositories/prices.ts`:
```ts
import type { DB } from "../db/connection.js";
import type { PriceBar } from "../types.js";

export function upsertPrice(db: DB, bar: PriceBar): void {
  db.prepare(
    `INSERT INTO prices (ticker, date, open, high, low, close, volume, source)
     VALUES (@ticker, @date, @open, @high, @low, @close, @volume, @source)
     ON CONFLICT(ticker, date) DO UPDATE SET
       open=excluded.open, high=excluded.high, low=excluded.low,
       close=excluded.close, volume=excluded.volume, source=excluded.source`
  ).run(bar);
}

export function upsertPrices(db: DB, bars: PriceBar[]): void {
  const tx = db.transaction((rows: PriceBar[]) => {
    for (const b of rows) upsertPrice(db, b);
  });
  tx(bars);
}

export function getLatestPrice(db: DB, ticker: string): PriceBar | null {
  const row = db
    .prepare(`SELECT * FROM prices WHERE ticker = ? ORDER BY date DESC LIMIT 1`)
    .get(ticker) as PriceBar | undefined;
  return row ?? null;
}

export function getPriceHistory(db: DB, ticker: string, from: string, to: string): PriceBar[] {
  return db
    .prepare(`SELECT * FROM prices WHERE ticker = ? AND date >= ? AND date <= ? ORDER BY date`)
    .all(ticker, from, to) as PriceBar[];
}

export function getLatestPriceDate(db: DB): string | null {
  const row = db.prepare(`SELECT MAX(date) AS d FROM prices`).get() as { d: string | null };
  return row.d ?? null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @egx/core test prices.repo`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): add prices repository"
```

---

### Task 6: Watchlist / alerts repository

**Files:**
- Create: `packages/core/src/repositories/watchlist.ts`
- Test: `packages/core/test/watchlist.repo.test.ts`

**Interfaces:**
- Consumes: `DB`, `Alert`, `NewAlert` (Task 2); securities repo (Task 3) for setup.
- Produces:
  - `addAlert(db: DB, a: NewAlert): Alert` — `active` defaults true, `createdAt` defaults today, `triggeredAt` null.
  - `listAlerts(db: DB, activeOnly?: boolean): Alert[]` — ordered by id.
  - `setAlertActive(db: DB, id: number, active: boolean): void`
  - `markTriggered(db: DB, id: number, when: string): void`
  - `deleteAlert(db: DB, id: number): void`

- [ ] **Step 1: Write the failing test**

`packages/core/test/watchlist.repo.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { openDb, type DB } from "../src/db/connection.js";
import { migrate } from "../src/db/migrate.js";
import { upsertSecurity } from "../src/repositories/securities.js";
import {
  addAlert, listAlerts, setAlertActive, markTriggered, deleteAlert,
} from "../src/repositories/watchlist.js";

let db: DB;
beforeEach(() => {
  db = openDb(":memory:");
  migrate(db);
  upsertSecurity(db, { ticker: "COMI.EGX", name: "CIB", sector: "Banks", currency: "EGP" });
});

describe("watchlist repo", () => {
  it("adds an alert with defaults", () => {
    const a = addAlert(db, { ticker: "COMI.EGX", targetPrice: 9000, direction: "above" });
    expect(a.id).toBeGreaterThan(0);
    expect(a.active).toBe(true);
    expect(a.triggeredAt).toBeNull();
    expect(a.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("filters active only", () => {
    const a = addAlert(db, { ticker: "COMI.EGX", targetPrice: 9000, direction: "above" });
    addAlert(db, { ticker: "COMI.EGX", targetPrice: 5000, direction: "below" });
    setAlertActive(db, a.id, false);
    expect(listAlerts(db, true)).toHaveLength(1);
    expect(listAlerts(db)).toHaveLength(2);
  });

  it("marks triggered", () => {
    const a = addAlert(db, { ticker: "COMI.EGX", targetPrice: 9000, direction: "above" });
    markTriggered(db, a.id, "2026-06-02");
    expect(listAlerts(db)[0].triggeredAt).toBe("2026-06-02");
  });

  it("deletes an alert", () => {
    const a = addAlert(db, { ticker: "COMI.EGX", targetPrice: 9000, direction: "above" });
    deleteAlert(db, a.id);
    expect(listAlerts(db)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @egx/core test watchlist.repo`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`packages/core/src/repositories/watchlist.ts`:
```ts
import type { DB } from "../db/connection.js";
import type { Alert, NewAlert } from "../types.js";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function mapRow(r: any): Alert {
  return {
    id: r.id, ticker: r.ticker, targetPrice: r.target_price,
    direction: r.direction, active: !!r.active, note: r.note,
    createdAt: r.created_at, triggeredAt: r.triggered_at,
  };
}

export function addAlert(db: DB, a: NewAlert): Alert {
  const row = {
    ticker: a.ticker, target_price: a.targetPrice, direction: a.direction,
    note: a.note ?? null, created_at: today(),
  };
  const info = db
    .prepare(
      `INSERT INTO watchlist_alerts (ticker, target_price, direction, active, note, created_at, triggered_at)
       VALUES (@ticker, @target_price, @direction, 1, @note, @created_at, NULL)`
    )
    .run(row);
  return mapRow({ id: Number(info.lastInsertRowid), active: 1, triggered_at: null, ...row });
}

export function listAlerts(db: DB, activeOnly = false): Alert[] {
  const rows = activeOnly
    ? db.prepare(`SELECT * FROM watchlist_alerts WHERE active = 1 ORDER BY id`).all()
    : db.prepare(`SELECT * FROM watchlist_alerts ORDER BY id`).all();
  return (rows as any[]).map(mapRow);
}

export function setAlertActive(db: DB, id: number, active: boolean): void {
  db.prepare(`UPDATE watchlist_alerts SET active = ? WHERE id = ?`).run(active ? 1 : 0, id);
}

export function markTriggered(db: DB, id: number, when: string): void {
  db.prepare(`UPDATE watchlist_alerts SET triggered_at = ? WHERE id = ?`).run(when, id);
}

export function deleteAlert(db: DB, id: number): void {
  db.prepare(`DELETE FROM watchlist_alerts WHERE id = ?`).run(id);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @egx/core test watchlist.repo`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): add watchlist/alerts repository"
```

---

### Task 7: Portfolio holdings derivation (weighted-average cost)

**Files:**
- Create: `packages/core/src/portfolio/holdings.ts`
- Test: `packages/core/test/holdings.test.ts`

**Interfaces:**
- Consumes: `Transaction`, `Holding` (Task 2).
- Produces:
  - `deriveHoldings(transactions: Transaction[]): Holding[]` — pure function. Weighted-average cost. Buy fee added to cost basis; sell fee reduces realized proceeds. Cost accumulated as integer piasters (`totalCost`) to avoid drift; `avgCost = round(totalCost / qty)`, `costBasis = totalCost`. Only returns tickers with `qty > 0`, sorted by ticker.

- [ ] **Step 1: Write the failing test**

`packages/core/test/holdings.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { deriveHoldings } from "../src/portfolio/holdings.js";
import type { Transaction } from "../src/types.js";

let seq = 0;
const tx = (p: Partial<Transaction> & Pick<Transaction, "ticker" | "side" | "qty" | "price">): Transaction => ({
  id: ++seq, fee: 0, tradedAt: "2026-06-01", note: null, ...p,
});

describe("deriveHoldings", () => {
  it("single buy: qty, avgCost, costBasis", () => {
    const h = deriveHoldings([tx({ ticker: "COMI.EGX", side: "buy", qty: 500, price: 7240 })]);
    expect(h).toEqual([
      { ticker: "COMI.EGX", qty: 500, avgCost: 7240, costBasis: 3620000, realizedPnl: 0 },
    ]);
  });

  it("buy fee is folded into cost basis", () => {
    const h = deriveHoldings([tx({ ticker: "COMI.EGX", side: "buy", qty: 100, price: 1000, fee: 500 })]);
    // totalCost = 100*1000 + 500 = 100500; avgCost = round(100500/100) = 1005
    expect(h[0].costBasis).toBe(100500);
    expect(h[0].avgCost).toBe(1005);
  });

  it("two buys average correctly", () => {
    const h = deriveHoldings([
      tx({ ticker: "COMI.EGX", side: "buy", qty: 100, price: 1000 }),
      tx({ ticker: "COMI.EGX", side: "buy", qty: 100, price: 2000 }),
    ]);
    // totalCost = 100000 + 200000 = 300000; qty 200; avg 1500
    expect(h[0]).toMatchObject({ qty: 200, avgCost: 1500, costBasis: 300000 });
  });

  it("partial sell computes realized pnl and keeps avg cost", () => {
    const h = deriveHoldings([
      tx({ ticker: "COMI.EGX", side: "buy", qty: 200, price: 1000 }), // avg 1000
      tx({ ticker: "COMI.EGX", side: "sell", qty: 50, price: 1500 }), // realized = 50*1500 - 50*1000 = 25000
    ]);
    expect(h[0].qty).toBe(150);
    expect(h[0].avgCost).toBe(1000);
    expect(h[0].costBasis).toBe(150000);
    expect(h[0].realizedPnl).toBe(25000);
  });

  it("sell fee reduces realized pnl", () => {
    const h = deriveHoldings([
      tx({ ticker: "COMI.EGX", side: "buy", qty: 100, price: 1000 }),
      tx({ ticker: "COMI.EGX", side: "sell", qty: 100, price: 1500, fee: 300 }),
    ]);
    // realized = 100*1500 - 300 - 100*1000 = 49700; qty 0 -> excluded
    expect(h).toEqual([]);
  });

  it("excludes fully-closed positions but not open ones", () => {
    const h = deriveHoldings([
      tx({ ticker: "COMI.EGX", side: "buy", qty: 100, price: 1000 }),
      tx({ ticker: "COMI.EGX", side: "sell", qty: 100, price: 1200 }),
      tx({ ticker: "HRHO.EGX", side: "buy", qty: 10, price: 500 }),
    ]);
    expect(h.map((x) => x.ticker)).toEqual(["HRHO.EGX"]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @egx/core test holdings`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`packages/core/src/portfolio/holdings.ts`:
```ts
import type { Transaction, Holding } from "../types.js";

interface Acc {
  qty: number;
  totalCost: number; // integer piasters
  realizedPnl: number; // integer piasters
}

export function deriveHoldings(transactions: Transaction[]): Holding[] {
  const sorted = [...transactions].sort(
    (a, b) => (a.tradedAt < b.tradedAt ? -1 : a.tradedAt > b.tradedAt ? 1 : a.id - b.id)
  );
  const acc = new Map<string, Acc>();

  for (const t of sorted) {
    const a = acc.get(t.ticker) ?? { qty: 0, totalCost: 0, realizedPnl: 0 };
    if (t.side === "buy") {
      a.qty += t.qty;
      a.totalCost += t.qty * t.price + t.fee;
    } else {
      const avgCost = a.qty > 0 ? a.totalCost / a.qty : 0;
      const costRemoved = Math.round(avgCost * t.qty);
      a.realizedPnl += t.qty * t.price - t.fee - Math.round(avgCost * t.qty);
      a.qty -= t.qty;
      a.totalCost -= costRemoved;
      if (a.qty <= 0) {
        a.qty = 0;
        a.totalCost = 0;
      }
    }
    acc.set(t.ticker, a);
  }

  const holdings: Holding[] = [];
  for (const [ticker, a] of acc) {
    if (a.qty > 0) {
      holdings.push({
        ticker,
        qty: a.qty,
        avgCost: Math.round(a.totalCost / a.qty),
        costBasis: a.totalCost,
        realizedPnl: a.realizedPnl,
      });
    }
  }
  return holdings.sort((x, y) => (x.ticker < y.ticker ? -1 : 1));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @egx/core test holdings`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): derive holdings from transactions (weighted-average cost)"
```

---

### Task 8: Portfolio valuation + summary

**Files:**
- Create: `packages/core/src/portfolio/summary.ts`
- Test: `packages/core/test/summary.test.ts`

**Interfaces:**
- Consumes: `DB`, `Holding`, `HoldingValuation`, `PortfolioSummary` (Task 2); `deriveHoldings` (Task 7); `listTransactions` (Task 4); `getLatestPrice`, `getLatestPriceDate` (Task 5).
- Produces:
  - `valueHoldings(db: DB, holdings: Holding[]): HoldingValuation[]` — joins each holding with its latest price. If no price: `lastClose`/`marketValue`/`unrealizedPnl`/`unrealizedPnlPct` are null.
  - `getPortfolioSummary(db: DB): PortfolioSummary` — loads all transactions, derives holdings, values them, aggregates totals. Totals count only holdings that have a price. `totalUnrealizedPnlPct = totalCostBasis > 0 ? totalUnrealizedPnl / totalCostBasis : 0`.

- [ ] **Step 1: Write the failing test**

`packages/core/test/summary.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { openDb, type DB } from "../src/db/connection.js";
import { migrate } from "../src/db/migrate.js";
import { upsertSecurity } from "../src/repositories/securities.js";
import { addTransaction } from "../src/repositories/transactions.js";
import { upsertPrice } from "../src/repositories/prices.js";
import { getPortfolioSummary, valueHoldings } from "../src/portfolio/summary.js";
import { deriveHoldings } from "../src/portfolio/holdings.js";
import { listTransactions } from "../src/repositories/transactions.js";

let db: DB;
beforeEach(() => {
  db = openDb(":memory:");
  migrate(db);
  upsertSecurity(db, { ticker: "COMI.EGX", name: "CIB", sector: "Banks", currency: "EGP" });
});

describe("valuation + summary", () => {
  it("values a holding against latest close", () => {
    addTransaction(db, { ticker: "COMI.EGX", side: "buy", qty: 100, price: 1000, tradedAt: "2026-06-01" });
    upsertPrice(db, { ticker: "COMI.EGX", date: "2026-06-02", open: 1200, high: 1200, low: 1200, close: 1200, volume: 1, source: "eodhd" });
    const h = valueHoldings(db, deriveHoldings(listTransactions(db)));
    expect(h[0].lastClose).toBe(1200);
    expect(h[0].marketValue).toBe(120000);
    expect(h[0].unrealizedPnl).toBe(20000); // 120000 - 100000
    expect(h[0].unrealizedPnlPct).toBeCloseTo(0.2, 5);
  });

  it("leaves valuation null when no price exists", () => {
    addTransaction(db, { ticker: "COMI.EGX", side: "buy", qty: 100, price: 1000 });
    const h = valueHoldings(db, deriveHoldings(listTransactions(db)));
    expect(h[0].lastClose).toBeNull();
    expect(h[0].marketValue).toBeNull();
    expect(h[0].unrealizedPnl).toBeNull();
  });

  it("aggregates portfolio summary totals", () => {
    addTransaction(db, { ticker: "COMI.EGX", side: "buy", qty: 100, price: 1000, tradedAt: "2026-06-01" });
    upsertPrice(db, { ticker: "COMI.EGX", date: "2026-06-02", open: 1200, high: 1200, low: 1200, close: 1200, volume: 1, source: "eodhd" });
    const s = getPortfolioSummary(db);
    expect(s.totalMarketValue).toBe(120000);
    expect(s.totalCostBasis).toBe(100000);
    expect(s.totalUnrealizedPnl).toBe(20000);
    expect(s.totalUnrealizedPnlPct).toBeCloseTo(0.2, 5);
    expect(s.asOf).toBe("2026-06-02");
  });

  it("empty portfolio yields zeros", () => {
    const s = getPortfolioSummary(db);
    expect(s.totalMarketValue).toBe(0);
    expect(s.totalUnrealizedPnlPct).toBe(0);
    expect(s.holdings).toEqual([]);
    expect(s.asOf).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @egx/core test summary`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`packages/core/src/portfolio/summary.ts`:
```ts
import type { DB } from "../db/connection.js";
import type { Holding, HoldingValuation, PortfolioSummary } from "../types.js";
import { deriveHoldings } from "./holdings.js";
import { listTransactions } from "../repositories/transactions.js";
import { getLatestPrice, getLatestPriceDate } from "../repositories/prices.js";

export function valueHoldings(db: DB, holdings: Holding[]): HoldingValuation[] {
  return holdings.map((h) => {
    const price = getLatestPrice(db, h.ticker);
    if (!price) {
      return { ...h, lastClose: null, lastCloseDate: null, marketValue: null, unrealizedPnl: null, unrealizedPnlPct: null };
    }
    const marketValue = price.close * h.qty;
    const unrealizedPnl = marketValue - h.costBasis;
    const unrealizedPnlPct = h.costBasis > 0 ? unrealizedPnl / h.costBasis : 0;
    return {
      ...h,
      lastClose: price.close,
      lastCloseDate: price.date,
      marketValue,
      unrealizedPnl,
      unrealizedPnlPct,
    };
  });
}

export function getPortfolioSummary(db: DB): PortfolioSummary {
  const holdings = valueHoldings(db, deriveHoldings(listTransactions(db)));
  let totalMarketValue = 0;
  let totalCostBasis = 0;
  let totalRealizedPnl = 0;
  for (const h of holdings) {
    totalRealizedPnl += h.realizedPnl;
    if (h.marketValue !== null) {
      totalMarketValue += h.marketValue;
      totalCostBasis += h.costBasis;
    }
  }
  const totalUnrealizedPnl = totalMarketValue - totalCostBasis;
  return {
    asOf: getLatestPriceDate(db),
    totalMarketValue,
    totalCostBasis,
    totalUnrealizedPnl,
    totalUnrealizedPnlPct: totalCostBasis > 0 ? totalUnrealizedPnl / totalCostBasis : 0,
    totalRealizedPnl,
    holdings,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @egx/core test summary`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): add portfolio valuation and summary"
```

---

### Task 9: Alert evaluation

**Files:**
- Create: `packages/core/src/alerts/evaluate.ts`
- Test: `packages/core/test/evaluate.test.ts`

**Interfaces:**
- Consumes: `DB`, `Alert`, `TriggeredAlert` (Task 2); `listAlerts`, `markTriggered` (Task 6); `getLatestPrice` (Task 5).
- Produces:
  - `evaluateAlerts(db: DB): TriggeredAlert[]` — for each active alert with a latest price, `above` triggers when `close >= target`, `below` when `close <= target`. Newly triggered alerts are stamped with the latest price date via `markTriggered`. Returns the triggered list. Alerts already triggered (`triggeredAt != null`) are skipped.

- [ ] **Step 1: Write the failing test**

`packages/core/test/evaluate.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { openDb, type DB } from "../src/db/connection.js";
import { migrate } from "../src/db/migrate.js";
import { upsertSecurity } from "../src/repositories/securities.js";
import { upsertPrice } from "../src/repositories/prices.js";
import { addAlert, listAlerts } from "../src/repositories/watchlist.js";
import { evaluateAlerts } from "../src/alerts/evaluate.js";

const price = (close: number) => ({ ticker: "COMI.EGX", date: "2026-06-02", open: close, high: close, low: close, close, volume: 1, source: "eodhd" });

let db: DB;
beforeEach(() => {
  db = openDb(":memory:");
  migrate(db);
  upsertSecurity(db, { ticker: "COMI.EGX", name: "CIB", sector: "Banks", currency: "EGP" });
});

describe("evaluateAlerts", () => {
  it("triggers an 'above' alert when close crosses target", () => {
    addAlert(db, { ticker: "COMI.EGX", targetPrice: 8000, direction: "above" });
    upsertPrice(db, price(8415));
    const t = evaluateAlerts(db);
    expect(t).toHaveLength(1);
    expect(t[0].lastClose).toBe(8415);
    expect(listAlerts(db)[0].triggeredAt).toBe("2026-06-02");
  });

  it("does not trigger 'above' below target", () => {
    addAlert(db, { ticker: "COMI.EGX", targetPrice: 9000, direction: "above" });
    upsertPrice(db, price(8415));
    expect(evaluateAlerts(db)).toHaveLength(0);
  });

  it("triggers 'below' when close at or under target", () => {
    addAlert(db, { ticker: "COMI.EGX", targetPrice: 5000, direction: "below" });
    upsertPrice(db, price(5000));
    expect(evaluateAlerts(db)).toHaveLength(1);
  });

  it("skips already-triggered alerts on re-run", () => {
    addAlert(db, { ticker: "COMI.EGX", targetPrice: 8000, direction: "above" });
    upsertPrice(db, price(8415));
    evaluateAlerts(db);
    expect(evaluateAlerts(db)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @egx/core test evaluate`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`packages/core/src/alerts/evaluate.ts`:
```ts
import type { DB } from "../db/connection.js";
import type { TriggeredAlert } from "../types.js";
import { listAlerts, markTriggered } from "../repositories/watchlist.js";
import { getLatestPrice } from "../repositories/prices.js";

export function evaluateAlerts(db: DB): TriggeredAlert[] {
  const triggered: TriggeredAlert[] = [];
  for (const alert of listAlerts(db, true)) {
    if (alert.triggeredAt) continue;
    const price = getLatestPrice(db, alert.ticker);
    if (!price) continue;
    const hit =
      alert.direction === "above"
        ? price.close >= alert.targetPrice
        : price.close <= alert.targetPrice;
    if (hit) {
      markTriggered(db, alert.id, price.date);
      triggered.push({ alert: { ...alert, triggeredAt: price.date }, lastClose: price.close, lastCloseDate: price.date });
    }
  }
  return triggered;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @egx/core test evaluate`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): evaluate watchlist alerts against latest close"
```

---

### Task 10: Daily digest builder

**Files:**
- Create: `packages/core/src/digest/build.ts`
- Test: `packages/core/test/digest.test.ts`

**Interfaces:**
- Consumes: `DB`, `PortfolioSummary`, `TriggeredAlert`, `HoldingValuation` (Task 2); `getPortfolioSummary` (Task 8); `evaluateAlerts` (Task 9).
- Produces:
  - `interface Digest { date: string | null; totalMarketValue: number; totalUnrealizedPnl: number; totalUnrealizedPnlPct: number; triggered: TriggeredAlert[]; topMovers: HoldingValuation[]; }`
  - `buildDigest(db: DB): Digest` — runs summary + alert evaluation, picks the top 3 movers by absolute `unrealizedPnlPct` (only priced holdings), most extreme first.

- [ ] **Step 1: Write the failing test**

`packages/core/test/digest.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { openDb, type DB } from "../src/db/connection.js";
import { migrate } from "../src/db/migrate.js";
import { upsertSecurity } from "../src/repositories/securities.js";
import { addTransaction } from "../src/repositories/transactions.js";
import { upsertPrice } from "../src/repositories/prices.js";
import { addAlert } from "../src/repositories/watchlist.js";
import { buildDigest } from "../src/digest/build.js";

const priceBar = (ticker: string, close: number) => ({ ticker, date: "2026-06-02", open: close, high: close, low: close, close, volume: 1, source: "eodhd" });

let db: DB;
beforeEach(() => {
  db = openDb(":memory:");
  migrate(db);
  for (const [t, n] of [["COMI.EGX", "CIB"], ["HRHO.EGX", "EFG"], ["FWRY.EGX", "Fawry"]] as const) {
    upsertSecurity(db, { ticker: t, name: n, sector: "X", currency: "EGP" });
  }
});

describe("buildDigest", () => {
  it("summarizes value, triggered alerts, and top movers", () => {
    addTransaction(db, { ticker: "COMI.EGX", side: "buy", qty: 100, price: 1000, tradedAt: "2026-06-01" });
    addTransaction(db, { ticker: "HRHO.EGX", side: "buy", qty: 100, price: 1000, tradedAt: "2026-06-01" });
    upsertPrice(db, priceBar("COMI.EGX", 1500)); // +50%
    upsertPrice(db, priceBar("HRHO.EGX", 900));  // -10%
    addAlert(db, { ticker: "COMI.EGX", targetPrice: 1400, direction: "above" });

    const d = buildDigest(db);
    expect(d.date).toBe("2026-06-02");
    expect(d.totalMarketValue).toBe(240000);
    expect(d.triggered).toHaveLength(1);
    expect(d.topMovers[0].ticker).toBe("COMI.EGX"); // biggest abs move first
    expect(d.topMovers.length).toBeLessThanOrEqual(3);
  });

  it("empty portfolio yields an empty-but-valid digest", () => {
    const d = buildDigest(db);
    expect(d.totalMarketValue).toBe(0);
    expect(d.triggered).toEqual([]);
    expect(d.topMovers).toEqual([]);
    expect(d.date).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @egx/core test digest`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`packages/core/src/digest/build.ts`:
```ts
import type { DB } from "../db/connection.js";
import type { HoldingValuation, TriggeredAlert } from "../types.js";
import { getPortfolioSummary } from "../portfolio/summary.js";
import { evaluateAlerts } from "../alerts/evaluate.js";

export interface Digest {
  date: string | null;
  totalMarketValue: number;
  totalUnrealizedPnl: number;
  totalUnrealizedPnlPct: number;
  triggered: TriggeredAlert[];
  topMovers: HoldingValuation[];
}

export function buildDigest(db: DB): Digest {
  const summary = getPortfolioSummary(db);
  const triggered = evaluateAlerts(db);
  const topMovers = summary.holdings
    .filter((h) => h.unrealizedPnlPct !== null)
    .sort((a, b) => Math.abs(b.unrealizedPnlPct!) - Math.abs(a.unrealizedPnlPct!))
    .slice(0, 3);
  return {
    date: summary.asOf,
    totalMarketValue: summary.totalMarketValue,
    totalUnrealizedPnl: summary.totalUnrealizedPnl,
    totalUnrealizedPnlPct: summary.totalUnrealizedPnlPct,
    triggered,
    topMovers,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @egx/core test digest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): build daily digest (value, alerts, top movers)"
```

---

### Task 11: EODHD client (injected fetch, mocked in tests)

**Files:**
- Create: `packages/core/src/eodhd/client.ts`
- Test: `packages/core/test/eodhd.test.ts`

**Interfaces:**
- Consumes: `PriceBar` (Task 2).
- Produces:
  - `class EodhdError extends Error { status: number }`
  - `interface EodhdOptions { apiKey: string; fetchImpl?: typeof fetch; baseUrl?: string; }`
  - `class EodhdClient { constructor(opts: EodhdOptions); getEod(ticker, from, to): Promise<PriceBar[]>; search(query): Promise<{ ticker: string; name: string }[]> }`
  - `getEod` maps EODHD JSON (`{date, open, high, low, close, volume}` in EGP floats) to `PriceBar` in piasters via `Math.round(v * 100)`, `source: "eodhd"`.
  - `search` calls `/api/search/{query}` and returns only `.EGX` symbols, mapping `{Code, Exchange, Name}` to `{ ticker: "CODE.EGX", name }`.
  - Non-2xx responses throw `EodhdError` with the HTTP status.

- [ ] **Step 1: Write the failing test**

`packages/core/test/eodhd.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { EodhdClient, EodhdError } from "../src/eodhd/client.js";

function fakeFetch(status: number, body: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe("EodhdClient", () => {
  it("maps EOD floats to piaster PriceBars", async () => {
    const client = new EodhdClient({
      apiKey: "k",
      fetchImpl: fakeFetch(200, [
        { date: "2026-06-02", open: 80.0, high: 85.2, low: 79.5, close: 84.15, volume: 1000 },
      ]),
    });
    const bars = await client.getEod("COMI.EGX", "2026-06-01", "2026-06-02");
    expect(bars[0]).toEqual({
      ticker: "COMI.EGX", date: "2026-06-02",
      open: 8000, high: 8520, low: 7950, close: 8415, volume: 1000, source: "eodhd",
    });
  });

  it("filters search results to .EGX", async () => {
    const client = new EodhdClient({
      apiKey: "k",
      fetchImpl: fakeFetch(200, [
        { Code: "COMI", Exchange: "EGX", Name: "Commercial International Bank" },
        { Code: "AAPL", Exchange: "US", Name: "Apple" },
      ]),
    });
    const res = await client.search("COMI");
    expect(res).toEqual([{ ticker: "COMI.EGX", name: "Commercial International Bank" }]);
  });

  it("throws EodhdError on non-2xx", async () => {
    const client = new EodhdClient({ apiKey: "k", fetchImpl: fakeFetch(402, { message: "plan" }) });
    await expect(client.getEod("COMI.EGX", "2026-06-01", "2026-06-02")).rejects.toBeInstanceOf(EodhdError);
    await expect(client.getEod("COMI.EGX", "2026-06-01", "2026-06-02")).rejects.toMatchObject({ status: 402 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @egx/core test eodhd`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`packages/core/src/eodhd/client.ts`:
```ts
import type { PriceBar } from "../types.js";

export class EodhdError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "EodhdError";
    this.status = status;
  }
}

export interface EodhdOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

interface EodRow { date: string; open: number; high: number; low: number; close: number; volume: number; }
interface SearchRow { Code: string; Exchange: string; Name: string; }

const toPiasters = (v: number): number => Math.round(v * 100);

export class EodhdClient {
  private apiKey: string;
  private fetchImpl: typeof fetch;
  private baseUrl: string;

  constructor(opts: EodhdOptions) {
    this.apiKey = opts.apiKey;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.baseUrl = opts.baseUrl ?? "https://eodhd.com/api";
  }

  private async getJson(url: string): Promise<unknown> {
    const res = await this.fetchImpl(url);
    if (!res.ok) throw new EodhdError(res.status, `EODHD request failed: ${res.status}`);
    return res.json();
  }

  async getEod(ticker: string, from: string, to: string): Promise<PriceBar[]> {
    const url = `${this.baseUrl}/eod/${encodeURIComponent(ticker)}?api_token=${this.apiKey}&fmt=json&from=${from}&to=${to}`;
    const rows = (await this.getJson(url)) as EodRow[];
    return rows.map((r) => ({
      ticker,
      date: r.date,
      open: toPiasters(r.open),
      high: toPiasters(r.high),
      low: toPiasters(r.low),
      close: toPiasters(r.close),
      volume: r.volume,
      source: "eodhd",
    }));
  }

  async search(query: string): Promise<{ ticker: string; name: string }[]> {
    const url = `${this.baseUrl}/search/${encodeURIComponent(query)}?api_token=${this.apiKey}&fmt=json`;
    const rows = (await this.getJson(url)) as SearchRow[];
    return rows
      .filter((r) => r.Exchange === "EGX")
      .map((r) => ({ ticker: `${r.Code}.EGX`, name: r.Name }));
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @egx/core test eodhd`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): add EODHD client with injected fetch"
```

---

### Task 12: Public API surface + price-sync service + integration smoke test

**Files:**
- Create: `packages/core/src/services/syncPrices.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/integration.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces:
  - `syncPrices(db: DB, client: EodhdClient, tickers: string[], from: string, to: string): Promise<number>` — fetches EOD for each ticker, upserts bars, returns total bars stored. On a per-ticker `EodhdError` it skips that ticker (graceful degrade) and continues.
  - `packages/core/src/index.ts` re-exports the public surface (types, `openDb`, `migrate`, all repositories, `deriveHoldings`, `getPortfolioSummary`, `valueHoldings`, `evaluateAlerts`, `buildDigest`, `EodhdClient`, `EodhdError`, `syncPrices`).

- [ ] **Step 1: Write the price-sync service**

`packages/core/src/services/syncPrices.ts`:
```ts
import type { DB } from "../db/connection.js";
import { EodhdClient, EodhdError } from "../eodhd/client.js";
import { upsertPrices } from "../repositories/prices.js";

export async function syncPrices(
  db: DB, client: EodhdClient, tickers: string[], from: string, to: string
): Promise<number> {
  let stored = 0;
  for (const ticker of tickers) {
    try {
      const bars = await client.getEod(ticker, from, to);
      upsertPrices(db, bars);
      stored += bars.length;
    } catch (e) {
      if (e instanceof EodhdError) continue; // graceful degrade; keep last stored close
      throw e;
    }
  }
  return stored;
}
```

- [ ] **Step 2: Write the public index**

`packages/core/src/index.ts`:
```ts
export * from "./types.js";
export { openDb, type DB } from "./db/connection.js";
export { migrate } from "./db/migrate.js";
export * from "./repositories/securities.js";
export * from "./repositories/transactions.js";
export * from "./repositories/prices.js";
export * from "./repositories/watchlist.js";
export { deriveHoldings } from "./portfolio/holdings.js";
export { valueHoldings, getPortfolioSummary } from "./portfolio/summary.js";
export { evaluateAlerts } from "./alerts/evaluate.js";
export { buildDigest, type Digest } from "./digest/build.js";
export { EodhdClient, EodhdError, type EodhdOptions } from "./eodhd/client.js";
export { syncPrices } from "./services/syncPrices.js";
```

- [ ] **Step 3: Write the integration smoke test**

`packages/core/test/integration.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  openDb, migrate, upsertSecurity, addTransaction, addAlert,
  EodhdClient, syncPrices, getPortfolioSummary, buildDigest,
} from "../src/index.js";

function fakeFetch(rows: unknown): typeof fetch {
  return (async () => new Response(JSON.stringify(rows), { status: 200 })) as unknown as typeof fetch;
}

describe("core integration", () => {
  it("runs the full flow: security -> tx -> sync -> summary -> digest", async () => {
    const db = openDb(":memory:");
    migrate(db);
    upsertSecurity(db, { ticker: "COMI.EGX", name: "CIB", sector: "Banks", currency: "EGP" });
    addTransaction(db, { ticker: "COMI.EGX", side: "buy", qty: 100, price: 1000, tradedAt: "2026-06-01" });
    addAlert(db, { ticker: "COMI.EGX", targetPrice: 1400, direction: "above" });

    const client = new EodhdClient({
      apiKey: "k",
      fetchImpl: fakeFetch([{ date: "2026-06-02", open: 1500 / 100, high: 1500 / 100, low: 1500 / 100, close: 1500 / 100, volume: 10 }]),
    });
    const stored = await syncPrices(db, client, ["COMI.EGX"], "2026-06-01", "2026-06-02");
    expect(stored).toBe(1);

    const summary = getPortfolioSummary(db);
    expect(summary.totalMarketValue).toBe(150000);
    expect(summary.totalUnrealizedPnl).toBe(50000);

    const digest = buildDigest(db);
    expect(digest.triggered).toHaveLength(1);
    expect(digest.topMovers[0].ticker).toBe("COMI.EGX");
  });
});
```

- [ ] **Step 4: Run the full test suite + typecheck**

Run: `pnpm --filter @egx/core test && pnpm --filter @egx/core typecheck`
Expected: ALL tests PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): add price-sync service and public API surface"
```

---

## Self-Review

**Spec coverage:**
- Data model (securities, transactions, prices, watchlist_alerts, settings) → Task 2 schema. ✓ (`settings` table created; no repo yet — used by later plans for `last_eod_fetch`, no core logic depends on it, so no orphan reference.)
- Transactions as source of truth, derived holdings, weighted-avg cost, realized/unrealized split → Tasks 7–8. ✓
- Integer piaster money math → Global Constraints + enforced throughout. ✓
- MCP read/write tool data (list_positions, summary, price history, watchlist, triggered alerts, securities) → backed by Tasks 3–9 functions; the MCP tool wrappers themselves are Plan 2. ✓ (out of this plan's scope by design)
- EODHD client + fetch-on-access/refresh → `EodhdClient` (Task 11) + `syncPrices` (Task 12). Trigger wiring (fetch-if-stale, launchd) is Plan 2/3. ✓
- Error handling: EODHD non-2xx → `EodhdError`; `syncPrices` degrades gracefully per ticker → Tasks 11–12. ✓
- Ticker validation via search → `EodhdClient.search` filters `.EGX` (Task 11). ✓
- Testing: core is the primary test target, repos integration-tested against temp SQLite (`:memory:`), EODHD mocked → all tasks. ✓

**Placeholder scan:** No TBD/TODO; every code step contains full code. ✓

**Type consistency:** `Piasters` integer piasters used uniformly; `deriveHoldings`→`valueHoldings`→`getPortfolioSummary`→`buildDigest` chain uses consistent `Holding`/`HoldingValuation`/`PortfolioSummary` shapes; `EodhdClient` method names (`getEod`, `search`) match `syncPrices` usage and Task 11/12 interface blocks. ✓

**Deferred to later plans (intentional, not gaps):** MCP server (`apps/mcp`), Next.js dashboard (`apps/web`), fetch-if-stale trigger, optional launchd digest job, `settings` repo. These are Plans 2 and 3.
