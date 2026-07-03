# EGX Tracker — Web App Implementation Plan (Plan 3 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A working Next.js dashboard (`apps/web`) over `@egx/core` — view holdings + P&L, add transactions, manage a watchlist, see the daily digest, seed demo data, and refresh EOD prices — persisted to a local SQLite file.

**Architecture:** Next.js 16 App Router (React 19, TypeScript). Server Components read `@egx/core` directly through a file-backed DB singleton; mutations use Server Actions. `better-sqlite3` runs only server-side. Styled to the "EGX Folio" dark-green fintech mockup with plain CSS variables (no CSS framework).

**Tech Stack:** Next.js ^16, React ^19, TypeScript 5, `@egx/core` (workspace), better-sqlite3 (transitively, server-only).

## Global Constraints

- **Money:** `@egx/core` stores/returns integer **piasters**. The web layer converts EGP↔piasters ONLY at the form/display boundary (`Math.round(egp*100)` in, `/100` out). Never floating-point math on money.
- **Percentages** from core are decimal fractions (0.16 = 16%).
- **Dates:** `'YYYY-MM-DD'`. **Tickers:** `CODE.EGX`.
- **DB access is server-only.** `better-sqlite3` and `getDb()` must never be imported into a Client Component. Use `import "server-only"` in DB/data modules.
- **Next config:** `transpilePackages: ["@egx/core"]` (core is TS source) AND `serverExternalPackages: ["better-sqlite3"]` (native, not bundled).
- **Theme:** dark-green EGX Folio look — background `#052e16` family, green `#22c55e` gain / red loss, accent lime `#a3e635`, Inter/system font. Gains green, losses red, always with sign.
- ESM only. Conventional Commits; NO AI attribution.

---

### Task 1: Inline core's SQL schema (remove runtime file read)

**Why:** `migrate.ts` currently reads `schema.sql` from disk via `import.meta.url`. When `@egx/core` is bundled by Next, that path won't resolve. Inlining the DDL as a TS constant removes the runtime filesystem dependency so core bundles cleanly, and permanently closes the packaging risk flagged in review.

**Files:**
- Create: `packages/core/src/db/schema.ts`
- Modify: `packages/core/src/db/migrate.ts`
- Delete: `packages/core/src/db/schema.sql`
- Test: `packages/core/test/db.test.ts` (already exists — must still pass unchanged)

**Interfaces:**
- Consumes: nothing new.
- Produces: `export const SCHEMA_SQL: string` in `schema.ts`; `migrate(db)` unchanged in signature/behavior.

- [ ] **Step 1: Create the schema constant**

`packages/core/src/db/schema.ts`:
```ts
export const SCHEMA_SQL = `
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
`;
```

- [ ] **Step 2: Rewrite migrate.ts to use the constant**

`packages/core/src/db/migrate.ts`:
```ts
import type { DB } from "./connection.js";
import { SCHEMA_SQL } from "./schema.js";

export function migrate(db: DB): void {
  db.exec(SCHEMA_SQL);
}
```

- [ ] **Step 3: Delete the now-unused SQL file**

Run: `git rm packages/core/src/db/schema.sql`

- [ ] **Step 4: Run the suite**

Run: `pnpm --filter @egx/core test && pnpm --filter @egx/core typecheck`
Expected: all tests pass (db.test.ts unchanged), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(core): inline SQL schema so core bundles without a runtime file read"
```

---

### Task 2: Scaffold `apps/web` — Next.js shell, DB singleton, data layer, theme

**Files:**
- Create: `apps/web/package.json`, `apps/web/next.config.ts`, `apps/web/tsconfig.json`, `apps/web/next-env.d.ts` (generated), `apps/web/.gitignore`
- Create: `apps/web/app/layout.tsx`, `apps/web/app/globals.css`, `apps/web/app/page.tsx` (placeholder), `apps/web/components/Nav.tsx`
- Create: `apps/web/lib/db.ts`, `apps/web/lib/format.ts`, `apps/web/lib/data.ts`
- Test: `apps/web/test/format.test.ts`
- Modify: root `pnpm-workspace.yaml` already globs `apps/*` (no change needed)

**Interfaces:**
- Produces:
  - `getDb(): DB` (server-only, file-backed, migrated, HMR-cached) in `lib/db.ts`
  - `egp(p: number | null): string`, `pct(x: number | null): string`, `toPiasters(egpStr: string|number): number` in `lib/format.ts`
  - `data` module (server-only) in `lib/data.ts`: `summary()`, `transactions()`, `securities()`, `alerts()`, `digest()` — thin wrappers over core using `getDb()`.

- [ ] **Step 1: Create package + config**

`apps/web/package.json`:
```json
{
  "name": "@egx/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@egx/core": "workspace:*",
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "server-only": "^0.0.1"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

`apps/web/next.config.ts`:
```ts
import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@egx/core"],
  serverExternalPackages: ["better-sqlite3"],
};

export default config;
```

`apps/web/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "jsx": "preserve",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "resolveJsonModule": true,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`apps/web/.gitignore`:
```
/.next/
/data/
next-env.d.ts
```

- [ ] **Step 2: DB singleton + formatting + data layer**

`apps/web/lib/db.ts`:
```ts
import "server-only";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { openDb, migrate, type DB } from "@egx/core";

const dbPath = process.env.EGX_DB_PATH ?? join(process.cwd(), "data", "egx.db");

declare global {
  // eslint-disable-next-line no-var
  var __egxDb: DB | undefined;
}

export function getDb(): DB {
  if (!globalThis.__egxDb) {
    mkdirSync(dirname(dbPath), { recursive: true });
    const db = openDb(dbPath);
    migrate(db);
    globalThis.__egxDb = db;
  }
  return globalThis.__egxDb;
}
```

`apps/web/lib/format.ts`:
```ts
const fmt = new Intl.NumberFormat("en-EG", {
  style: "currency",
  currency: "EGP",
  currencyDisplay: "code",
});

/** piasters -> "EGP 1,234.56" */
export function egp(piasters: number | null): string {
  return piasters === null ? "—" : fmt.format(piasters / 100);
}

/** decimal fraction -> "16.23%" (with sign) */
export function pct(x: number | null): string {
  if (x === null) return "—";
  const s = (x * 100).toFixed(2);
  return `${x > 0 ? "+" : ""}${s}%`;
}

/** EGP string/number from a form -> integer piasters */
export function toPiasters(egpValue: string | number): number {
  const n = typeof egpValue === "string" ? parseFloat(egpValue) : egpValue;
  return Math.round((Number.isFinite(n) ? n : 0) * 100);
}
```

`apps/web/lib/data.ts`:
```ts
import "server-only";
import {
  getPortfolioSummary,
  listTransactions,
  listSecurities,
  listAlerts,
  buildDigest,
} from "@egx/core";
import { getDb } from "./db.js";

export const data = {
  summary: () => getPortfolioSummary(getDb()),
  transactions: () => listTransactions(getDb()),
  securities: () => listSecurities(getDb()),
  alerts: () => listAlerts(getDb()),
  digest: () => buildDigest(getDb()),
};
```

- [ ] **Step 3: Theme + app shell + nav + placeholder page**

`apps/web/app/globals.css`:
```css
:root {
  --bg: #052e16;
  --bg-panel: #0a3d24;
  --bg-elev: #0d4a2c;
  --border: #14532d;
  --text: #ecfdf5;
  --text-dim: #86c9a4;
  --gain: #22c55e;
  --loss: #f87171;
  --accent: #a3e635;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-variant-numeric: tabular-nums;
  line-height: 1.5;
}
a { color: inherit; text-decoration: none; }
.container { max-width: 1100px; margin: 0 auto; padding: 24px; }
.nav { display: flex; gap: 20px; align-items: center; padding: 16px 24px; border-bottom: 1px solid var(--border); }
.nav a { color: var(--text-dim); font-weight: 600; }
.nav a.active, .nav a:hover { color: var(--text); }
.brand { font-weight: 800; font-size: 20px; color: var(--text); margin-right: auto; }
.panel { background: var(--bg-panel); border: 1px solid var(--border); border-radius: 12px; padding: 20px; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: right; padding: 10px 12px; border-bottom: 1px solid var(--border); }
th:first-child, td:first-child { text-align: left; }
th { color: var(--text-dim); font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
.gain { color: var(--gain); }
.loss { color: var(--loss); }
.dim { color: var(--text-dim); }
.btn { background: var(--accent); color: #052e16; border: none; border-radius: 8px; padding: 8px 14px; font-weight: 700; cursor: pointer; }
.btn.secondary { background: transparent; color: var(--text); border: 1px solid var(--border); }
input, select { background: var(--bg-elev); border: 1px solid var(--border); color: var(--text); border-radius: 8px; padding: 8px 10px; font: inherit; }
label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-dim); }
.row { display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-end; }
.grid { display: grid; gap: 16px; }
.stat { font-size: 24px; font-weight: 800; }
.overflow-x { overflow-x: auto; }
```

`apps/web/components/Nav.tsx`:
```tsx
import Link from "next/link";

export function Nav() {
  return (
    <nav className="nav">
      <Link href="/" className="brand">EGX Folio</Link>
      <Link href="/">Portfolio</Link>
      <Link href="/transactions">Transactions</Link>
      <Link href="/watchlist">Watchlist</Link>
    </nav>
  );
}
```

`apps/web/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = { title: "EGX Folio", description: "EGX portfolio tracker" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
```

`apps/web/app/page.tsx` (placeholder, replaced in Task 3):
```tsx
export default function Page() {
  return <div className="panel">Dashboard coming up.</div>;
}
```

- [ ] **Step 4: Formatting test**

`apps/web/test/format.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { egp, pct, toPiasters } from "../lib/format.js";

describe("format", () => {
  it("formats piasters as EGP", () => {
    expect(egp(362000)).toBe("EGP 3,620.00");
    expect(egp(null)).toBe("—");
  });
  it("formats decimal fraction as signed percent", () => {
    expect(pct(0.1623)).toBe("+16.23%");
    expect(pct(-0.1)).toBe("-10.00%");
    expect(pct(null)).toBe("—");
  });
  it("converts EGP to integer piasters", () => {
    expect(toPiasters("72.40")).toBe(7240);
    expect(toPiasters(5.1)).toBe(510);
  });
});
```
Note: `egp` uses `Intl` with `currencyDisplay: "code"`, which yields `"EGP 3,620.00"` on Node 20+ ICU. If the runtime emits a non-breaking space, normalize in the assertion — but standard Node builds produce a regular space here.

- [ ] **Step 5: Install, test, build**

Run:
```bash
pnpm install
pnpm --filter @egx/web test
pnpm --filter @egx/web build
```
Expected: format tests pass; `next build` succeeds (placeholder dashboard compiles; DB module only imported by server code, not the placeholder).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(web): scaffold Next.js app with core-backed db singleton, theme, and data layer"
```

---

### Task 3: Dashboard page

**Files:**
- Modify: `apps/web/app/page.tsx`
- Create: `apps/web/components/HoldingsTable.tsx`, `apps/web/components/SummaryBand.tsx`, `apps/web/components/DigestCard.tsx`

**Interfaces:**
- Consumes: `data.summary()`, `data.digest()` (Task 2).
- Produces: the `/` route rendering the portfolio.

- [ ] **Step 1: Summary band + holdings table + digest components**

`apps/web/components/SummaryBand.tsx`:
```tsx
import { egp, pct } from "@/lib/format";
import type { PortfolioSummary } from "@egx/core";

export function SummaryBand({ s }: { s: PortfolioSummary }) {
  const cls = (n: number) => (n > 0 ? "gain" : n < 0 ? "loss" : "");
  return (
    <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}>
      <div className="panel"><div className="dim">Market value</div><div className="stat">{egp(s.totalMarketValue)}</div></div>
      <div className="panel"><div className="dim">Cost basis</div><div className="stat">{egp(s.totalCostBasis)}</div></div>
      <div className="panel"><div className="dim">Unrealized P&L</div><div className={`stat ${cls(s.totalUnrealizedPnl)}`}>{egp(s.totalUnrealizedPnl)} <span style={{fontSize:14}}>({pct(s.totalUnrealizedPnlPct)})</span></div></div>
      <div className="panel"><div className="dim">Realized P&L</div><div className={`stat ${cls(s.totalRealizedPnl)}`}>{egp(s.totalRealizedPnl)}</div></div>
    </div>
  );
}
```

`apps/web/components/HoldingsTable.tsx`:
```tsx
import { egp, pct } from "@/lib/format";
import type { HoldingValuation } from "@egx/core";

export function HoldingsTable({ holdings }: { holdings: HoldingValuation[] }) {
  if (holdings.length === 0) {
    return <div className="panel dim">No holdings yet. Add a transaction, or load demo data from the dashboard header.</div>;
  }
  const cls = (n: number | null) => (n === null ? "" : n > 0 ? "gain" : n < 0 ? "loss" : "");
  return (
    <div className="panel overflow-x">
      <table>
        <thead><tr>
          <th>Ticker</th><th>Qty</th><th>Avg cost</th><th>Last</th><th>Mkt value</th><th>Unrealized</th><th>P&L %</th>
        </tr></thead>
        <tbody>
          {holdings.map((h) => (
            <tr key={h.ticker}>
              <td>{h.ticker}</td>
              <td>{h.qty.toLocaleString()}</td>
              <td>{egp(h.avgCost)}</td>
              <td>{egp(h.lastClose)}</td>
              <td>{egp(h.marketValue)}</td>
              <td className={cls(h.unrealizedPnl)}>{egp(h.unrealizedPnl)}</td>
              <td className={cls(h.unrealizedPnlPct)}>{pct(h.unrealizedPnlPct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

`apps/web/components/DigestCard.tsx`:
```tsx
import { egp, pct } from "@/lib/format";
import type { Digest } from "@egx/core";

export function DigestCard({ d }: { d: Digest }) {
  return (
    <div className="panel grid" style={{ gap: 12 }}>
      <div style={{ fontWeight: 700 }}>Daily digest {d.date ? <span className="dim">· prices as of {d.date}</span> : null}</div>
      <div>
        <div className="dim">Triggered alerts ({d.triggered.length})</div>
        {d.triggered.length === 0 ? <div className="dim">None</div> : d.triggered.map((t) => (
          <div key={t.alert.id}>• {t.alert.ticker} {t.alert.direction} {egp(t.alert.targetPrice)} — crossed at {egp(t.lastClose)}</div>
        ))}
      </div>
      <div>
        <div className="dim">Top movers</div>
        {d.topMovers.length === 0 ? <div className="dim">None</div> : d.topMovers.map((m) => (
          <div key={m.ticker}>• {m.ticker} <span className={m.unrealizedPnlPct && m.unrealizedPnlPct > 0 ? "gain" : "loss"}>{pct(m.unrealizedPnlPct)}</span></div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire the dashboard page**

`apps/web/app/page.tsx`:
```tsx
import { data } from "@/lib/data";
import { SummaryBand } from "@/components/SummaryBand";
import { HoldingsTable } from "@/components/HoldingsTable";
import { DigestCard } from "@/components/DigestCard";
import { DataControls } from "@/components/DataControls";

export const dynamic = "force-dynamic";

export default function Dashboard() {
  const s = data.summary();
  const d = data.digest();
  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>Portfolio {s.asOf ? <span className="dim" style={{ fontSize: 14 }}>· prices as of {s.asOf}</span> : null}</h1>
        <DataControls />
      </div>
      <SummaryBand s={s} />
      <HoldingsTable holdings={s.holdings} />
      <DigestCard d={d} />
    </div>
  );
}
```
Note: `DataControls` is created in Task 6; until then, temporarily omit its import + usage OR stub it as `export function DataControls() { return null; }` in `apps/web/components/DataControls.tsx`. Create the stub now so this task builds standalone; Task 6 replaces it.

- [ ] **Step 3: Build + smoke**

Run: `pnpm --filter @egx/web build`
Expected: build succeeds. (No DB rows yet → empty-state renders.)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(web): dashboard with summary band, holdings table, and digest"
```

---

### Task 4: Transactions page (list + add + delete)

**Files:**
- Create: `apps/web/app/transactions/page.tsx`, `apps/web/app/transactions/actions.ts`

**Interfaces:**
- Consumes: `data.transactions()`, core `upsertSecurity`, `addTransaction`, `deleteTransaction`, `getDb`, `toPiasters`.
- Produces: `/transactions` route with a server-action form.

- [ ] **Step 1: Server actions**

`apps/web/app/transactions/actions.ts`:
```ts
"use server";
import { revalidatePath } from "next/cache";
import { upsertSecurity, addTransaction, deleteTransaction } from "@egx/core";
import { getDb } from "@/lib/db";
import { toPiasters } from "@/lib/format";

export async function createTransaction(formData: FormData) {
  const db = getDb();
  const ticker = String(formData.get("ticker") || "").trim().toUpperCase();
  if (!ticker) return;
  const name = String(formData.get("name") || "").trim() || ticker;
  const sector = String(formData.get("sector") || "").trim() || null;
  upsertSecurity(db, { ticker, name, sector, currency: "EGP" });
  addTransaction(db, {
    ticker,
    side: formData.get("side") === "sell" ? "sell" : "buy",
    qty: parseInt(String(formData.get("qty") || "0"), 10),
    price: toPiasters(String(formData.get("price") || "0")),
    fee: toPiasters(String(formData.get("fee") || "0")),
    tradedAt: String(formData.get("tradedAt") || "") || undefined,
    note: String(formData.get("note") || "").trim() || null,
  });
  revalidatePath("/transactions");
  revalidatePath("/");
}

export async function removeTransaction(formData: FormData) {
  deleteTransaction(getDb(), parseInt(String(formData.get("id")), 10));
  revalidatePath("/transactions");
  revalidatePath("/");
}
```

- [ ] **Step 2: Page**

`apps/web/app/transactions/page.tsx`:
```tsx
import { data } from "@/lib/data";
import { egp } from "@/lib/format";
import { createTransaction, removeTransaction } from "./actions";

export const dynamic = "force-dynamic";

export default function TransactionsPage() {
  const txns = data.transactions();
  return (
    <div className="grid" style={{ gap: 20 }}>
      <h1>Transactions</h1>
      <form action={createTransaction} className="panel row">
        <label>Ticker<input name="ticker" placeholder="COMI.EGX" required /></label>
        <label>Name<input name="name" placeholder="Commercial International Bank" /></label>
        <label>Sector<input name="sector" placeholder="Banks" /></label>
        <label>Side<select name="side"><option value="buy">Buy</option><option value="sell">Sell</option></select></label>
        <label>Qty<input name="qty" type="number" min="1" required /></label>
        <label>Price (EGP)<input name="price" type="number" step="0.01" min="0" required /></label>
        <label>Fee (EGP)<input name="fee" type="number" step="0.01" min="0" defaultValue="0" /></label>
        <label>Date<input name="tradedAt" type="date" /></label>
        <label>Note<input name="note" /></label>
        <button className="btn" type="submit">Add</button>
      </form>
      <div className="panel overflow-x">
        <table>
          <thead><tr><th>Date</th><th>Ticker</th><th>Side</th><th>Qty</th><th>Price</th><th>Fee</th><th>Note</th><th></th></tr></thead>
          <tbody>
            {txns.length === 0 ? (
              <tr><td colSpan={8} className="dim">No transactions yet.</td></tr>
            ) : txns.map((t) => (
              <tr key={t.id}>
                <td>{t.tradedAt}</td><td>{t.ticker}</td>
                <td className={t.side === "buy" ? "gain" : "loss"}>{t.side}</td>
                <td>{t.qty.toLocaleString()}</td><td>{egp(t.price)}</td><td>{egp(t.fee)}</td>
                <td className="dim">{t.note ?? ""}</td>
                <td><form action={removeTransaction}><input type="hidden" name="id" value={t.id} /><button className="btn secondary" type="submit">Delete</button></form></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build**

Run: `pnpm --filter @egx/web build`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(web): transactions page with add/delete server actions"
```

---

### Task 5: Watchlist page (list + add + toggle + delete)

**Files:**
- Create: `apps/web/app/watchlist/page.tsx`, `apps/web/app/watchlist/actions.ts`

**Interfaces:**
- Consumes: `data.alerts()`, `data.securities()`, core `upsertSecurity`, `addAlert`, `setAlertActive`, `deleteAlert`, `getDb`, `toPiasters`.
- Produces: `/watchlist` route.

- [ ] **Step 1: Actions**

`apps/web/app/watchlist/actions.ts`:
```ts
"use server";
import { revalidatePath } from "next/cache";
import { upsertSecurity, addAlert, setAlertActive, deleteAlert } from "@egx/core";
import { getDb } from "@/lib/db";
import { toPiasters } from "@/lib/format";

export async function createAlert(formData: FormData) {
  const db = getDb();
  const ticker = String(formData.get("ticker") || "").trim().toUpperCase();
  if (!ticker) return;
  upsertSecurity(db, { ticker, name: ticker, sector: null, currency: "EGP" });
  addAlert(db, {
    ticker,
    targetPrice: toPiasters(String(formData.get("target") || "0")),
    direction: formData.get("direction") === "below" ? "below" : "above",
    note: String(formData.get("note") || "").trim() || null,
  });
  revalidatePath("/watchlist");
}

export async function toggleAlert(formData: FormData) {
  setAlertActive(getDb(), parseInt(String(formData.get("id")), 10), formData.get("active") === "1");
  revalidatePath("/watchlist");
}

export async function removeAlert(formData: FormData) {
  deleteAlert(getDb(), parseInt(String(formData.get("id")), 10));
  revalidatePath("/watchlist");
}
```

- [ ] **Step 2: Page**

`apps/web/app/watchlist/page.tsx`:
```tsx
import { data } from "@/lib/data";
import { egp } from "@/lib/format";
import { createAlert, toggleAlert, removeAlert } from "./actions";

export const dynamic = "force-dynamic";

export default function WatchlistPage() {
  const alerts = data.alerts();
  return (
    <div className="grid" style={{ gap: 20 }}>
      <h1>Watchlist</h1>
      <form action={createAlert} className="panel row">
        <label>Ticker<input name="ticker" placeholder="COMI.EGX" required /></label>
        <label>Direction<select name="direction"><option value="above">Above</option><option value="below">Below</option></select></label>
        <label>Target (EGP)<input name="target" type="number" step="0.01" min="0" required /></label>
        <label>Note<input name="note" /></label>
        <button className="btn" type="submit">Add alert</button>
      </form>
      <div className="panel overflow-x">
        <table>
          <thead><tr><th>Ticker</th><th>Direction</th><th>Target</th><th>Status</th><th>Note</th><th></th></tr></thead>
          <tbody>
            {alerts.length === 0 ? (
              <tr><td colSpan={6} className="dim">No alerts yet.</td></tr>
            ) : alerts.map((a) => (
              <tr key={a.id}>
                <td>{a.ticker}</td><td>{a.direction}</td><td>{egp(a.targetPrice)}</td>
                <td>{a.triggeredAt ? <span className="gain">crossed {a.triggeredAt}</span> : a.active ? "watching" : <span className="dim">inactive</span>}</td>
                <td className="dim">{a.note ?? ""}</td>
                <td className="row" style={{ gap: 6 }}>
                  <form action={toggleAlert}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="active" value={a.active ? "0" : "1"} /><button className="btn secondary" type="submit">{a.active ? "Disable" : "Enable"}</button></form>
                  <form action={removeAlert}><input type="hidden" name="id" value={a.id} /><button className="btn secondary" type="submit">Delete</button></form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build**

Run: `pnpm --filter @egx/web build`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(web): watchlist page with add/toggle/delete alerts"
```

---

### Task 6: Data controls — seed demo + refresh prices; final end-to-end verification

**Files:**
- Create: `apps/web/app/actions.ts` (top-level app actions)
- Create/Replace: `apps/web/components/DataControls.tsx`
- Modify: `apps/web/.env.example`

**Interfaces:**
- Consumes: core `upsertSecurity`, `addTransaction`, `addAlert`, `upsertPrice`, `EodhdClient`, `syncPrices`, `listSecurities`, `getDb`.
- Produces: `seedDemo()` and `refreshPrices()` server actions + a `DataControls` client-triggered form with two buttons.

- [ ] **Step 1: App actions**

`apps/web/app/actions.ts`:
```ts
"use server";
import { revalidatePath } from "next/cache";
import {
  upsertSecurity, addTransaction, addAlert, upsertPrice,
  listSecurities, listTransactions, listAlerts,
  EodhdClient, syncPrices,
} from "@egx/core";
import { getDb } from "@/lib/db";

export async function seedDemo() {
  const db = getDb();
  const secs: [string, string, string][] = [
    ["COMI.EGX", "Commercial International Bank", "Banks"],
    ["HRHO.EGX", "EFG Holding", "Financials"],
    ["SWDY.EGX", "Elsewedy Electric", "Industrials"],
    ["FWRY.EGX", "Fawry", "Fintech"],
  ];
  for (const [ticker, name, sector] of secs) upsertSecurity(db, { ticker, name, sector, currency: "EGP" });
  const buys: [string, number, number, string][] = [
    ["COMI.EGX", 500, 7240, "2026-06-01"],
    ["HRHO.EGX", 1200, 1890, "2026-06-02"],
    ["SWDY.EGX", 600, 6100, "2026-06-03"],
    ["FWRY.EGX", 2000, 510, "2026-06-04"],
  ];
  for (const [ticker, qty, price, tradedAt] of buys) addTransaction(db, { ticker, side: "buy", qty, price, tradedAt });
  const closes: [string, number][] = [["COMI.EGX", 8415], ["HRHO.EGX", 2260], ["SWDY.EGX", 7830], ["FWRY.EGX", 685]];
  for (const [ticker, close] of closes) upsertPrice(db, { ticker, date: "2026-07-02", open: close, high: close, low: close, close, volume: 1_000_000, source: "demo" });
  addAlert(db, { ticker: "COMI.EGX", targetPrice: 8000, direction: "above", note: "take-profit" });
  addAlert(db, { ticker: "FWRY.EGX", targetPrice: 700, direction: "above" });
  revalidatePath("/"); revalidatePath("/transactions"); revalidatePath("/watchlist");
}

export async function refreshPrices() {
  const db = getDb();
  const key = process.env.EODHD_API_KEY;
  if (!key) return { ok: false, message: "Set EODHD_API_KEY in apps/web/.env.local to fetch live prices." };
  const tickers = Array.from(new Set([
    ...listTransactions(db).map((t) => t.ticker),
    ...listAlerts(db).map((a) => a.ticker),
  ]));
  if (tickers.length === 0) return { ok: false, message: "Nothing to refresh — add positions first." };
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const client = new EodhdClient({ apiKey: key });
  const stored = await syncPrices(db, client, tickers, from, to);
  revalidatePath("/");
  return { ok: true, message: `Stored ${stored} price bar(s).` };
}
```

- [ ] **Step 2: DataControls component**

`apps/web/components/DataControls.tsx`:
```tsx
"use client";
import { useState, useTransition } from "react";
import { seedDemo, refreshPrices } from "@/app/actions";

export function DataControls() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string>("");
  return (
    <div className="row" style={{ gap: 8, alignItems: "center" }}>
      {msg ? <span className="dim" style={{ fontSize: 13 }}>{msg}</span> : null}
      <button className="btn secondary" disabled={pending} onClick={() => start(async () => { await seedDemo(); setMsg("Demo data loaded."); })}>Load demo</button>
      <button className="btn" disabled={pending} onClick={() => start(async () => { const r = await refreshPrices(); setMsg(r.message); })}>Refresh prices</button>
    </div>
  );
}
```

- [ ] **Step 3: env example + gitignore .env.local**

`apps/web/.env.example`:
```
# Optional — only needed for live EOD price fetching
EODHD_API_KEY=
# Optional — override the SQLite file location
# EGX_DB_PATH=/absolute/path/to/egx.db
```
Add to `apps/web/.gitignore`: `.env.local` and `.env*.local`.

- [ ] **Step 4: Build**

Run: `pnpm --filter @egx/web build`
Expected: success (DataControls is a client component; server actions imported into it are fine via the "use server" boundary).

- [ ] **Step 5: End-to-end verification (manual drive)**

Run: `pnpm --filter @egx/web dev` (starts on http://localhost:3000).
Verify by driving the real app:
1. Open `/` → empty state.
2. Click **Load demo** → dashboard shows 4 holdings, totals, unrealized P&L green, COMI alert crossed in the digest.
3. Open `/transactions` → 4 buys listed; add a buy (e.g. `EAST.EGX`, 100 @ 50.00) → appears; dashboard updates.
4. Open `/watchlist` → 2 alerts; add one; toggle + delete work.
5. Confirm "prices as of 2026-07-02" shows on the dashboard.
Capture a screenshot of the populated dashboard. Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(web): seed-demo and refresh-prices controls; wire dashboard header"
```

---

## Self-Review

- Spec coverage: dashboard (holdings/P&L/allocation-via-top-movers/digest/prices-as-of) ✓ Task 3; add/edit transactions ✓ Task 4; watchlist + alerts ✓ Task 5; daily digest ✓ Task 3 (DigestCard); fetch-on-access price refresh + seed ✓ Task 6; EODHD optional + graceful ✓ Task 6. Allocation donut is simplified to a top-movers/summary presentation (charting lib deferred per design spec §10 — non-blocking).
- Money: EGP↔piaster conversion isolated to `format.ts`/actions; core untouched on money. ✓
- Bundling risk resolved by Task 1 (inlined schema) + `serverExternalPackages`/`transpilePackages`. ✓
- Server-only DB access enforced via `import "server-only"` in `db.ts`/`data.ts`. ✓
- Placeholder scan: `DataControls` is stubbed in Task 3 and replaced in Task 6 — explicitly sequenced, not a dangling placeholder.
- Deferred (non-blocking, future): allocation donut chart, light theme, per-holding price chart, launchd daily digest, auth (localhost single-user by design).
