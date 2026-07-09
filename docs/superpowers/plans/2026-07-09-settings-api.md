# Settings API + Settings Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A file-backed settings layer (`data/settings.json`) consumed identically by the web app, MCP, and the CLI. v1: `theme`, `accentColor`, `defaultPriceHistoryRange`, `dateFormat`. Theme/accent move server-side into `layout.tsx` (fixing the theme-flash problem at its root instead of the client-script band-aid); `dateFormat`/`defaultPriceHistoryRange` wire into their real call sites (`Topbar`, `PriceChart`).

**Architecture:** `lib/core/settings/{schema,store}.ts` is the single source of truth — zod schema with per-field defaults (so old `settings.json` files gain new keys automatically), plain `readFileSync`/`writeFileSync` against `data/settings.json`. MCP (`lib/mcp/tools.ts`) and CLI (`lib/cli/dispatch.ts`) get thin additions reusing existing machinery — two new tool definitions, two new `COMMANDS` map entries, no new CLI/MCP-specific code. Web gets a `/settings` page (Server Action form, no client JS) plus prop-threading of the two behavioral settings into the components that already have hardcoded equivalents.

**Tech Stack:** zod (already a dependency), Next.js Server Components/Actions, vitest.

## Global Constraints

- No secrets in `settings.json` — `EODHD_API_KEY` stays an environment variable.
- `data/settings.json`, gitignored, overridable via `EGX_SETTINGS_PATH` (mirrors `EGX_DB_PATH`).
- Every setting's default must match today's hardcoded behavior exactly — adopting this feature changes nothing visible until a user edits a setting.
- Every zod field needs its own `.default()` — this is what lets the file gain new keys later without a migration step.
- MCP/CLI settings tools/commands must reuse the exact same `updateSettings`/`readSettings` functions the web page uses — no parallel logic.
- Any test that touches settings must isolate `EGX_SETTINGS_PATH` to a temp directory in `beforeEach`/`afterEach` — never let a test read or write the real `data/settings.json`.

---

### Task 1: `lib/core/settings/` — schema, store, barrel exports, tests

**Files:**
- Create: `lib/core/settings/schema.ts`
- Create: `lib/core/settings/store.ts`
- Modify: `lib/core/index.ts`
- Create: `test/core/settings.test.ts`

**Interfaces:**
- Produces: `SettingsSchema: ZodObject`, `DEFAULT_SETTINGS: Settings`, `RANGE_DAYS: Record<PriceHistoryRange, number | null>`, types `Settings`, `PriceHistoryRange`, `DateFormat` (`lib/core/settings/schema.ts`).
- Produces: `readSettings(): Settings`, `writeSettings(settings: Settings): Settings`, `updateSettings(partial: Partial<Settings>): Settings` (`lib/core/settings/store.ts`).
- Produces (re-exported from the barrel): all of the above, importable as `from "../core/index.js"` / `from "@/lib/core/index"` depending on caller convention (matches how every other core module is already re-exported).

- [ ] **Step 1: Write `lib/core/settings/schema.ts`**

```ts
import { z } from "zod";

export const RANGE_VALUES = ["1W", "1M", "3M", "6M", "1Y", "max"] as const;
export const DATE_FORMAT_VALUES = ["en-GB", "iso", "en-US"] as const;

export const SettingsSchema = z.object({
  theme: z.enum(["dark", "light"]).default("dark"),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "must be a #rrggbb hex color")
    .default("#34d399"),
  defaultPriceHistoryRange: z.enum(RANGE_VALUES).default("max"),
  dateFormat: z.enum(DATE_FORMAT_VALUES).default("en-GB"),
});

export type Settings = z.infer<typeof SettingsSchema>;
export type PriceHistoryRange = (typeof RANGE_VALUES)[number];
export type DateFormat = (typeof DATE_FORMAT_VALUES)[number];

export const DEFAULT_SETTINGS: Settings = SettingsSchema.parse({});

export const RANGE_DAYS: Record<PriceHistoryRange, number | null> = {
  "1W": 7,
  "1M": 30,
  "3M": 90,
  "6M": 180,
  "1Y": 365,
  max: null,
};
```

- [ ] **Step 2: Write `lib/core/settings/store.ts`**

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { SettingsSchema, DEFAULT_SETTINGS, type Settings } from "./schema.js";

function settingsPath(): string {
  return process.env.EGX_SETTINGS_PATH ?? join(process.cwd(), "data", "settings.json");
}

export function readSettings(): Settings {
  const path = settingsPath();
  if (!existsSync(path)) return DEFAULT_SETTINGS;
  const raw = JSON.parse(readFileSync(path, "utf-8"));
  return SettingsSchema.parse(raw);
}

export function writeSettings(settings: Settings): Settings {
  const validated = SettingsSchema.parse(settings);
  const path = settingsPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(validated, null, 2) + "\n", "utf-8");
  return validated;
}

export function updateSettings(partial: Partial<Settings>): Settings {
  return writeSettings({ ...readSettings(), ...partial });
}
```

- [ ] **Step 3: Add the barrel exports**

Add to the end of `lib/core/index.ts`:

```ts
export { readSettings, writeSettings, updateSettings } from "./settings/store.js";
export {
  SettingsSchema,
  DEFAULT_SETTINGS,
  RANGE_DAYS,
  type Settings,
  type PriceHistoryRange,
  type DateFormat,
} from "./settings/schema.js";
```

- [ ] **Step 4: Write the failing tests**

Create `test/core/settings.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readSettings, writeSettings, updateSettings } from "../../lib/core/settings/store.js";
import { DEFAULT_SETTINGS } from "../../lib/core/settings/schema.js";

let dir: string;
let settingsPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "egx-settings-"));
  settingsPath = join(dir, "settings.json");
  process.env.EGX_SETTINGS_PATH = settingsPath;
});

afterEach(() => {
  delete process.env.EGX_SETTINGS_PATH;
  rmSync(dir, { recursive: true, force: true });
});

describe("settings store", () => {
  it("returns defaults when the file doesn't exist", () => {
    expect(readSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("round-trips a full write/read", () => {
    const custom = { theme: "light", accentColor: "#3b82f6", defaultPriceHistoryRange: "1M", dateFormat: "iso" } as const;
    writeSettings(custom);
    expect(readSettings()).toEqual(custom);
  });

  it("merges a partial update, leaving other fields alone", () => {
    writeSettings({ theme: "light", accentColor: "#3b82f6", defaultPriceHistoryRange: "1M", dateFormat: "iso" });
    updateSettings({ theme: "dark" });
    expect(readSettings()).toEqual({
      theme: "dark",
      accentColor: "#3b82f6",
      defaultPriceHistoryRange: "1M",
      dateFormat: "iso",
    });
  });

  it("fills in missing keys on an old settings file with schema defaults", () => {
    writeSettings(DEFAULT_SETTINGS);
    const raw = JSON.parse(readFileSync(settingsPath, "utf-8"));
    delete raw.dateFormat;
    writeFileSync(settingsPath, JSON.stringify(raw));
    expect(readSettings().dateFormat).toBe("en-GB");
  });

  it("rejects an invalid accent color", () => {
    expect(() => writeSettings({ ...DEFAULT_SETTINGS, accentColor: "red" })).toThrow();
  });
});
```

- [ ] **Step 5: Run the tests to verify they fail, then pass**

```bash
pnpm test -- test/core/settings.test.ts
```
Expected: FAIL first (before Steps 1-3), then re-run after writing the schema/store/barrel files above: PASS, all 5 tests green.

- [ ] **Step 6: Run the full suite and typecheck**

```bash
pnpm test
pnpm typecheck
```
Expected: 98 existing + 5 new = 103 tests pass; typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add lib/core/settings/ lib/core/index.ts test/core/settings.test.ts
git commit -m "feat: add file-backed settings store"
```

---

### Task 2: MCP `get_settings` / `update_settings` tools

**Files:**
- Modify: `lib/mcp/tools.ts`
- Create: `test/mcp/tools.settings.test.ts`

**Interfaces:**
- Consumes: `readSettings`, `updateSettings`, `type Settings` from `../core/index.js` (produced in Task 1).
- Produces: two new entries in the exported `tools: McpTool[]` array — `get_settings`, `update_settings` — automatically picked up by the existing MCP route (`app/api/mcp/route.ts`) and Claude Code registration with no other changes.

- [ ] **Step 1: Add the settings import to `lib/mcp/tools.ts`**

Change the existing import block at the top of `lib/mcp/tools.ts` from:
```ts
import {
  type DB,
  getPortfolioSummary, listSecurities, listTransactions, getPriceHistory,
  listAlerts, evaluateAlerts,
  getSecurity, upsertSecurity, addTransaction, deleteTransaction, addAlert,
  EodhdClient, syncPrices,
} from "../core/index.js";
```
to:
```ts
import {
  type DB,
  getPortfolioSummary, listSecurities, listTransactions, getPriceHistory,
  listAlerts, evaluateAlerts,
  getSecurity, upsertSecurity, addTransaction, deleteTransaction, addAlert,
  EodhdClient, syncPrices,
  readSettings, updateSettings,
} from "../core/index.js";
```

- [ ] **Step 2: Write the failing test**

Create `test/mcp/tools.settings.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb, migrate, type DB } from "../../lib/core/index.js";
import { tools } from "../../lib/mcp/tools.js";

function tool(name: string) {
  return tools.find((t) => t.name === name)!;
}

let db: DB;
let dir: string;

beforeEach(() => {
  db = openDb(":memory:");
  migrate(db);
  dir = mkdtempSync(join(tmpdir(), "egx-settings-mcp-"));
  process.env.EGX_SETTINGS_PATH = join(dir, "settings.json");
});

afterEach(() => {
  delete process.env.EGX_SETTINGS_PATH;
  rmSync(dir, { recursive: true, force: true });
});

describe("settings tools", () => {
  it("get_settings returns defaults on a fresh env", async () => {
    const result = (await tool("get_settings").handler(db, {})) as { theme: string };
    expect(result.theme).toBe("dark");
  });

  it("update_settings changes only the passed fields", async () => {
    const result = (await tool("update_settings").handler(db, { theme: "light" })) as {
      ok: boolean;
      settings: { theme: string; accentColor: string };
    };
    expect(result.ok).toBe(true);
    expect(result.settings.theme).toBe("light");
    expect(result.settings.accentColor).toBe("#34d399");
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
pnpm test -- test/mcp/tools.settings.test.ts
```
Expected: FAIL — `get_settings`/`update_settings` don't exist in `tools` yet, so `tool(name)` returns `undefined` and `.handler` throws.

- [ ] **Step 4: Add the two tool definitions**

Add to the end of the `tools` array in `lib/mcp/tools.ts`, right before the closing `];`:

```ts
  defineTool({
    name: "get_settings",
    description: "Get the app's saved settings (theme, accent color, default price-history range, date format).",
    inputSchema: {},
    handler: () => readSettings(),
  }),
  defineTool({
    name: "update_settings",
    description: "Update one or more settings. Only the fields you pass are changed; others are left as-is.",
    inputSchema: {
      theme: z.enum(["dark", "light"]).optional(),
      accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "must be a #rrggbb hex color").optional(),
      defaultPriceHistoryRange: z.enum(["1W", "1M", "3M", "6M", "1Y", "max"]).optional(),
      dateFormat: z.enum(["en-GB", "iso", "en-US"]).optional(),
    },
    handler: (_db, args) => ({ ok: true, settings: updateSettings(args) }),
  }),
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
pnpm test -- test/mcp/tools.settings.test.ts
```
Expected: PASS — both tests green.

- [ ] **Step 6: Run the full suite and typecheck**

```bash
pnpm test
pnpm typecheck
```
Expected: 103 + 2 = 105 tests pass; typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add lib/mcp/tools.ts test/mcp/tools.settings.test.ts
git commit -m "feat: add get_settings/update_settings MCP tools"
```

---

### Task 3: CLI `settings` / `set-settings` commands

**Files:**
- Modify: `lib/cli/dispatch.ts`
- Modify: `test/cli/dispatch.test.ts`

**Interfaces:**
- Consumes: the `get_settings`/`update_settings` tools produced in Task 2 (via the existing `tools` array `runCli` already imports).
- Produces: `settings` and `set-settings` entries in `runCli`'s command surface — no new dispatch code, since the existing `COMMANDS` map + generic flag parser already handle any tool's shape.

- [ ] **Step 1: Add the two command-map entries**

Add to the `COMMANDS` object in `lib/cli/dispatch.ts` (order matches the other entries — alphabetical-ish grouping isn't enforced elsewhere in the file, so just append):

```ts
  "settings": "get_settings",
  "set-settings": "update_settings",
```

- [ ] **Step 2: Replace `test/cli/dispatch.test.ts` to add settings-path isolation and two new tests**

The existing file has no `EGX_SETTINGS_PATH` isolation (it never needed any before). Replace the whole file:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb, migrate, type DB } from "../../lib/core/index.js";
import { runCli } from "../../lib/cli/dispatch.js";

let db: DB;
let dir: string;

beforeEach(() => {
  db = openDb(":memory:");
  migrate(db);
  dir = mkdtempSync(join(tmpdir(), "egx-settings-cli-"));
  process.env.EGX_SETTINGS_PATH = join(dir, "settings.json");
});

afterEach(() => {
  delete process.env.EGX_SETTINGS_PATH;
  rmSync(dir, { recursive: true, force: true });
});

describe("runCli", () => {
  it("list-positions on an empty portfolio returns an empty table", async () => {
    const { code, output } = await runCli(["list-positions"], db);
    expect(code).toBe(0);
    expect(output).toBe("(no results)");
  });

  it("record-transaction writes a transaction and returns it", async () => {
    const { code, output } = await runCli(
      ["record-transaction", "--ticker", "COMI.EGX", "--side", "buy", "--qty", "100", "--price", "84.15"],
      db,
    );
    expect(code).toBe(0);
    expect(output).toContain("ok: true");
  });

  it("rejects an invalid side with a validation error", async () => {
    const { code, output } = await runCli(
      ["record-transaction", "--ticker", "COMI.EGX", "--side", "hold", "--qty", "1", "--price", "1"],
      db,
    );
    expect(code).toBe(1);
    expect(output).toContain("side");
  });

  it("reports an unknown command", async () => {
    const { code, output } = await runCli(["bogus"], db);
    expect(code).toBe(1);
    expect(output).toContain("Unknown command");
  });

  it("help lists all commands", async () => {
    const { code, output } = await runCli(["help"], db);
    expect(code).toBe(0);
    expect(output).toContain("list-positions");
    expect(output).toContain("record-transaction");
    expect(output).toContain("settings");
    expect(output).toContain("set-settings");
  });

  it("settings returns the current settings", async () => {
    const { code, output } = await runCli(["settings"], db);
    expect(code).toBe(0);
    expect(output).toContain("theme: dark");
  });

  it("set-settings updates a field", async () => {
    const { code, output } = await runCli(["set-settings", "--theme", "light"], db);
    expect(code).toBe(0);
    expect(output).toContain("ok: true");
  });
});
```

- [ ] **Step 3: Run the tests**

```bash
pnpm test -- test/cli/dispatch.test.ts
```
Expected: PASS — all 7 tests green (5 existing + 2 new).

- [ ] **Step 4: Run the full suite and typecheck**

```bash
pnpm test
pnpm typecheck
```
Expected: 105 + 2 = 107 tests pass; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add lib/cli/dispatch.ts test/cli/dispatch.test.ts
git commit -m "feat: add settings/set-settings CLI commands"
```

---

### Task 4: Web integration — settings page, theme/accent server-side, dateFormat + range wiring

**Files:**
- Create: `app/settings/page.tsx`
- Create: `app/settings/actions.ts`
- Modify: `app/layout.tsx`
- Modify: `components/Topbar.tsx`
- Delete: `components/ThemeToggle.tsx`
- Modify: `components/Sidebar.tsx`
- Modify: `components/PriceChart.tsx`
- Modify: `components/HoldingsTable.tsx`
- Modify: `components/TickerChartStats.tsx`
- Modify: `app/page.tsx`
- Modify: `app/ticker/[symbol]/page.tsx`
- Modify: `lib/format.ts`
- Modify: `test/format.test.ts`

**Interfaces:**
- Consumes: `readSettings`, `updateSettings`, `RANGE_DAYS`, types `Settings`/`DateFormat` from Task 1's barrel.
- Produces: `formatDate(dateStr: string, format: DateFormat): string` (`lib/format.ts`) — new required `dateFormat: DateFormat` prop on `Topbar` and `PriceChart`; new required `defaultRangeDays: number | null` prop on `PriceChart`; new required `dateFormat`/`defaultRangeDays` props on `HoldingsTable` and `TickerChartStats` (passed straight through to their inner `PriceChart`).

- [ ] **Step 1: Add `formatDate` to `lib/format.ts` and its test**

Add to `lib/format.ts` (after the existing `import`, before or after the other exports — exact placement doesn't matter, append at the end):

```ts
import type { DateFormat } from "./core/index.js";
```

(add this to the top of the file, above the existing `const fmt = ...` line)

then append at the end of the file:

```ts
/** ISO "YYYY-MM-DD" -> a display string per the dateFormat setting. */
export function formatDate(dateStr: string, format: DateFormat): string {
  if (format === "iso") return dateStr;
  const dt = new Date(dateStr + "T00:00:00");
  if (format === "en-US") return dt.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
```

Add to `test/format.test.ts` (append inside the existing `describe("format", ...)` block, as a new `it`):

```ts
  it("formats a date per the dateFormat setting", () => {
    expect(formatDate("2026-07-09", "iso")).toBe("2026-07-09");
    expect(formatDate("2026-07-09", "en-GB")).toBe("09 Jul 2026");
    expect(formatDate("2026-07-09", "en-US")).toBe("Jul 09, 2026");
  });
```

and update its import line from:
```ts
import { egp, pct, toPiasters } from "../lib/format.js";
```
to:
```ts
import { egp, pct, toPiasters, formatDate } from "../lib/format.js";
```

Run: `pnpm test -- test/format.test.ts` — expect PASS, 4 tests green.

- [ ] **Step 2: Rewrite `components/PriceChart.tsx`**

Replace the whole file:

```tsx
"use client";
import { useRef, useState } from "react";
import { egp, pct, formatDate } from "@/lib/format";
import type { SparkPoint } from "@/lib/metrics";
import type { DateFormat } from "../lib/core/index.js";

const RANGES: [string, number | null][] = [["1W", 7], ["1M", 30], ["3M", 90], ["6M", 180], ["1Y", 365], ["Max", null]];

function initialWindow(points: number, days: number | null): [number, number] | null {
  return days === null ? null : [Math.max(0, points - days), points - 1];
}

function Area({ points, up, id, height, dateFormat, onZoom, onReset }: {
  points: SparkPoint[]; up: boolean; id: string; height: number; dateFormat: DateFormat;
  onZoom: (a: number, b: number) => void; onReset: () => void;
}) {
  const [hi, setHi] = useState<number | null>(null);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  if (points.length < 2) return <div className="dim" style={{ fontSize: 13, padding: "24px 0" }}>Not enough price history yet.</div>;

  const values = points.map((p) => p.close);
  const W = 640, H = height, pad = 8;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const X = (i: number) => pad + (i / (values.length - 1)) * (W - pad * 2);
  const Y = (v: number) => pad + (1 - (v - min) / span) * (H - pad * 2);
  const line = values.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
  const area = `M ${X(0).toFixed(1)},${H} L ` + values.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" L ") + ` L ${X(values.length - 1).toFixed(1)},${H} Z`;
  const color = up ? "var(--green)" : "var(--red)";
  const gid = `grad-${id}`;

  const idx = (e: React.MouseEvent) => {
    const r = wrapRef.current!.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    return Math.round(f * (values.length - 1));
  };
  const onDown = (e: React.MouseEvent) => { const i = idx(e); setDragStart(i); setDragEnd(i); setHi(null); };
  const onMove = (e: React.MouseEvent) => { const i = idx(e); if (dragStart != null) setDragEnd(i); else setHi(i); };
  const onUp = () => { if (dragStart != null && dragEnd != null) { const a = Math.min(dragStart, dragEnd), b = Math.max(dragStart, dragEnd); if (b - a >= 2) onZoom(a, b); } setDragStart(null); setDragEnd(null); };
  const onLeave = () => { setHi(null); setDragStart(null); setDragEnd(null); };

  const dragging = dragStart != null && dragEnd != null && dragStart !== dragEnd;
  const a = dragging ? Math.min(dragStart!, dragEnd!) : 0;
  const b = dragging ? Math.max(dragStart!, dragEnd!) : 0;
  const dot = !dragging && hi != null ? { xPct: (X(hi) / W) * 100, yPct: (Y(values[hi]) / H) * 100 } : null;

  return (
    <div ref={wrapRef} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onLeave} onDoubleClick={onReset} style={{ position: "relative", cursor: "crosshair", userSelect: "none" }}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: "block" }}>
        <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.28" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        <path d={area} fill={`url(#${gid})`} />
        <polyline points={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        {dragging ? <rect x={X(a)} y={0} width={X(b) - X(a)} height={H} fill="var(--accent)" fillOpacity="0.14" stroke="var(--accent)" strokeOpacity="0.4" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          : hi != null ? <line x1={X(hi)} y1={0} x2={X(hi)} y2={H} stroke="var(--label)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" /> : null}
      </svg>
      {dot ? (
        <>
          <div style={{ position: "absolute", left: `${dot.xPct}%`, top: `${dot.yPct}%`, width: 9, height: 9, marginLeft: -4.5, marginTop: -4.5, borderRadius: "50%", background: color, boxShadow: "0 0 0 3px var(--panel)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", left: `${dot.xPct}%`, top: -4, transform: `translateX(${dot.xPct > 60 ? "-106%" : "6%"})`, background: "var(--panel-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "4px 9px", fontSize: 12, whiteSpace: "nowrap", pointerEvents: "none", zIndex: 2 }}>
            <span className="muted">{formatDate(points[hi!].date, dateFormat)}</span> · <b>{egp(values[hi!])}</b>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function PriceChart({ points, id, height = 150, dateFormat, defaultRangeDays, onPeriodChange }: {
  points: SparkPoint[]; id: string; height?: number; dateFormat: DateFormat; defaultRangeDays: number | null;
  onPeriodChange?: (days: number | null) => void;
}) {
  const [win, setWin] = useState<[number, number] | null>(() => initialWindow(points.length, defaultRangeDays));
  const s = win ? win[0] : 0;
  const e = win ? win[1] : points.length - 1;
  const pts = points.slice(s, e + 1);
  const first = pts[0]?.close;
  const lastC = pts[pts.length - 1]?.close;
  const chg = pts.length >= 2 && first > 0 ? (lastC - first) / first : null;
  const isFull = !win || (win[0] === 0 && win[1] === points.length - 1);
  const presetActive = (days: number | null) => days === null ? isFull : !!win && win[1] === points.length - 1 && win[0] === Math.max(0, points.length - days);
  const setPreset = (days: number | null) => { setWin(days === null ? null : [Math.max(0, points.length - days), points.length - 1]); onPeriodChange?.(days); };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 12, flexWrap: "wrap" }}>
        <span className="muted" style={{ fontSize: 12 }}>Last {pts.length} day{pts.length === 1 ? "" : "s"}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="rng">{RANGES.map(([label, days]) => <button key={label} className={presetActive(days) ? "on" : ""} onClick={() => setPreset(days)}>{label}</button>)}</div>
          {chg !== null ? <span className={chg >= 0 ? "gain" : "loss"} style={{ fontSize: 13, fontWeight: 600 }}>{pct(chg)}</span> : null}
        </div>
      </div>
      <Area points={pts} up={(chg ?? 0) >= 0} id={id} height={height} dateFormat={dateFormat} onZoom={(la, lb) => setWin([s + la, s + lb])} onReset={() => setWin(null)} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <span className="muted" style={{ fontSize: 12 }}>{pts.length >= 1 ? formatDate(pts[0].date, dateFormat) : ""}</span>
        <span className="muted" style={{ fontSize: 12 }}>{pts.length >= 1 ? `${formatDate(pts[pts.length - 1].date, dateFormat)} · ${egp(lastC)}` : ""}</span>
      </div>
      <div className="muted" style={{ fontSize: 11, marginTop: 4, opacity: 0.7 }}>Drag to zoom · double-click to reset</div>
    </div>
  );
}
```

- [ ] **Step 3: Update `components/HoldingsTable.tsx`**

Replace the whole file:

```tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { egp, pct } from "@/lib/format";
import { PriceChart } from "@/components/PriceChart";
import type { HoldingRow } from "@/lib/metrics";
import type { DateFormat } from "../lib/core/index.js";

export function HoldingsTable({ holdings, dateFormat, defaultRangeDays }: {
  holdings: HoldingRow[]; dateFormat: DateFormat; defaultRangeDays: number | null;
}) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="panel">
      <div className="panel-head">Holdings <span className="hint">{holdings.length === 0 ? "" : "Click a row for detail · "}{holdings.length} position{holdings.length === 1 ? "" : "s"}</span></div>
      {holdings.length === 0 ? (
        <div className="empty">No holdings yet. Load demo data or add a transaction.</div>
      ) : (
        <div className="overflow-x">
          <table>
            <thead><tr><th>Ticker</th><th>Qty</th><th>Avg cost</th><th>Last close</th><th>Mkt value</th><th>Unrealized P&amp;L</th><th>Day</th></tr></thead>
            <tbody>{holdings.map((h) => <RowGroup key={h.ticker} h={h} dateFormat={dateFormat} defaultRangeDays={defaultRangeDays} isOpen={open === h.ticker} onToggle={() => setOpen(open === h.ticker ? null : h.ticker)} />)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RowGroup({ h, dateFormat, defaultRangeDays, isOpen, onToggle }: {
  h: HoldingRow; dateFormat: DateFormat; defaultRangeDays: number | null; isOpen: boolean; onToggle: () => void;
}) {
  const pnlCls = h.unrealizedPnl === null ? "" : h.unrealizedPnl > 0 ? "gain" : h.unrealizedPnl < 0 ? "loss" : "";
  const dayCls = h.dayChangePct === null ? "muted" : h.dayChangePct > 0 ? "gain" : h.dayChangePct < 0 ? "loss" : "";
  return (
    <>
      <tr onClick={onToggle} style={{ cursor: "pointer" }}>
        <td>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--label)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }}><path d="M9 6l6 6-6 6" /></svg>
            <span>{h.ticker}{h.sector ? <div className="muted" style={{ fontWeight: 400, fontSize: 12 }}>{h.sector}</div> : null}</span>
          </span>
        </td>
        <td>{h.qty.toLocaleString()}</td>
        <td>{egp(h.avgCost)}</td>
        <td>{egp(h.lastClose)}</td>
        <td>{egp(h.marketValue)}</td>
        <td className={pnlCls}>{egp(h.unrealizedPnl)}{h.unrealizedPnlPct !== null ? <div style={{ fontSize: 12, fontWeight: 400 }} className={pnlCls}>{pct(h.unrealizedPnlPct)}</div> : null}</td>
        <td className={dayCls}>{h.dayChangePct === null ? "—" : pct(h.dayChangePct)}</td>
      </tr>
      {isOpen ? (
        <tr className="detail-row">
          <td colSpan={7}>
            <div className="detail-grid">
              <div>
                <PriceChart points={h.spark} id={h.ticker.replace(/\W/g, "")} dateFormat={dateFormat} defaultRangeDays={defaultRangeDays} />
                <Link href={`/ticker/${encodeURIComponent(h.ticker)}`} className="btn" style={{ marginTop: 12, display: "inline-flex" }}>View details →</Link>
              </div>
              <div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Transaction history</div>
                {h.txns.length === 0 ? <div className="dim" style={{ fontSize: 13 }}>None.</div> : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {h.txns.map((t) => (
                      <div key={t.id} style={{ display: "flex", gap: 12, fontSize: 13, alignItems: "center" }}>
                        <span className={`tag ${t.side === "buy" ? "crossed" : "off"}`} style={{ minWidth: 46, justifyContent: "center", textTransform: "uppercase" }}>{t.side}</span>
                        <span className="dim" style={{ width: 92 }}>{t.tradedAt}</span>
                        <span>{t.qty.toLocaleString()} @ {egp(t.price)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
```

- [ ] **Step 4: Update `components/TickerChartStats.tsx`**

Change the props destructuring and its type from:
```tsx
export function TickerChartStats({ ticker, bars, lastClose, position }: { ticker: string; bars: StatBar[]; lastClose: number | null; position: HoldingValuation | null }) {
```
to:
```tsx
export function TickerChartStats({ ticker, bars, lastClose, position, dateFormat, defaultRangeDays }: {
  ticker: string; bars: StatBar[]; lastClose: number | null; position: HoldingValuation | null;
  dateFormat: DateFormat; defaultRangeDays: number | null;
}) {
```
and its import line from:
```tsx
import type { HoldingValuation } from "../lib/core/index.js";
```
to:
```tsx
import type { HoldingValuation, DateFormat } from "../lib/core/index.js";
```
and its `<PriceChart>` call from:
```tsx
        <PriceChart points={chartPoints} id={ticker.replace(/\W/g, "")} height={320} onPeriodChange={setPeriod} />
```
to:
```tsx
        <PriceChart points={chartPoints} id={ticker.replace(/\W/g, "")} height={320} dateFormat={dateFormat} defaultRangeDays={defaultRangeDays} onPeriodChange={setPeriod} />
```

- [ ] **Step 5: Update `app/page.tsx`**

Replace the whole file:

```tsx
import { dashboard } from "@/lib/metrics";
import { StatCards } from "@/components/StatCards";
import { HoldingsTable } from "@/components/HoldingsTable";
import { AllocationDonut } from "@/components/AllocationDonut";
import { TopMovers } from "@/components/TopMovers";
import { readSettings, RANGE_DAYS } from "../lib/core/index.js";

export const dynamic = "force-dynamic";

export default function Dashboard() {
  const vm = dashboard();
  const settings = readSettings();
  return (
    <div className="grid" style={{ gap: 20 }}>
      <div>
        <div className="page-title">Portfolio</div>
        <div className="page-sub">Your EGX positions, valued at the last market close.</div>
      </div>
      <StatCards vm={vm} />
      <div className="grid dash-grid">
        <HoldingsTable holdings={vm.holdings} dateFormat={settings.dateFormat} defaultRangeDays={RANGE_DAYS[settings.defaultPriceHistoryRange]} />
        <div className="grid" style={{ gap: 18 }}>
          <AllocationDonut allocation={vm.allocation} />
          <TopMovers movers={vm.topMovers} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Update `app/ticker/[symbol]/page.tsx`**

Change the import block from:
```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { tickerDetail } from "@/lib/ticker";
import { egp } from "@/lib/format";
import { TickerChartStats } from "@/components/TickerChartStats";
```
to:
```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { tickerDetail } from "@/lib/ticker";
import { egp } from "@/lib/format";
import { TickerChartStats } from "@/components/TickerChartStats";
import { readSettings, RANGE_DAYS } from "../../../lib/core/index.js";
```
and inside the function body, after `if (d) notFound();` add:
```tsx
  const settings = readSettings();
```
and change the `<TickerChartStats>` call from:
```tsx
      <TickerChartStats ticker={d.ticker} bars={d.bars} lastClose={d.lastClose} position={d.position} />
```
to:
```tsx
      <TickerChartStats ticker={d.ticker} bars={d.bars} lastClose={d.lastClose} position={d.position} dateFormat={settings.dateFormat} defaultRangeDays={RANGE_DAYS[settings.defaultPriceHistoryRange]} />
```

- [ ] **Step 7: Update `app/layout.tsx`**

Replace the whole file:

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { data } from "@/lib/data";
import { readSettings } from "../lib/core/index.js";

export const metadata: Metadata = { title: "EGX Folio", description: "EGX portfolio tracker" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  data.evaluate(); // keep alert statuses fresh on every load
  const badge = data.alerts().filter((a) => a.triggeredAt).length;
  const asOf = data.summary().asOf;
  const settings = readSettings();
  return (
    <html
      lang="en"
      className={settings.theme === "light" ? "light" : undefined}
      style={{ "--accent": settings.accentColor } as React.CSSProperties}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <div className="shell">
          <Sidebar watchlistBadge={badge} />
          <div className="main">
            <Topbar asOf={asOf} dateFormat={settings.dateFormat} />
            <div className="content">{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}
```

This removes the blocking `<script>`/`<head>` block added by the earlier theme-flash fix — the
theme/accent are now baked into the server response directly, so there's nothing left for a
client script to correct.

- [ ] **Step 8: Update `components/Topbar.tsx`**

Replace the whole file:

```tsx
"use client";
import { usePathname } from "next/navigation";
import { DataControls } from "./DataControls";
import { formatDate } from "@/lib/format";
import type { DateFormat } from "../lib/core/index.js";

const NAMES: Record<string, string> = {
  "/": "Portfolio",
  "/transactions": "Transactions",
  "/watchlist": "Watchlist",
  "/digest": "Digest",
  "/settings": "Settings",
};

export function Topbar({ asOf, dateFormat }: { asOf: string | null; dateFormat: DateFormat }) {
  const pathname = usePathname();
  const name = pathname === "/" ? "Portfolio" : NAMES[pathname] ?? "EGX Folio";
  return (
    <header className="topbar">
      <span className="crumb">{name}</span>
      <span className="spacer" />
      <span className="chip">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
        Prices as of <b>{asOf ? formatDate(asOf, dateFormat) : "—"}</b>
      </span>
      <DataControls />
    </header>
  );
}
```

- [ ] **Step 9: Delete `components/ThemeToggle.tsx`**

```bash
git rm components/ThemeToggle.tsx
```

- [ ] **Step 10: Add the Settings link to `components/Sidebar.tsx`**

Change the `ICONS` object from:
```tsx
const ICONS = {
  portfolio: "M12 3v9l6 3M21 12a9 9 0 1 1-9-9",
  tx: "M7 7h11l-3-3M17 17H6l3 3",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  doc: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Zm0 0v5h5M9 13h6M9 17h6",
};
```
to:
```tsx
const ICONS = {
  portfolio: "M12 3v9l6 3M21 12a9 9 0 1 1-9-9",
  tx: "M7 7h11l-3-3M17 17H6l3 3",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  doc: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Zm0 0v5h5M9 13h6M9 17h6",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
};
```
and the `LINKS` array from:
```tsx
const LINKS = [
  { href: "/", label: "Portfolio", icon: ICONS.portfolio },
  { href: "/transactions", label: "Transactions", icon: ICONS.tx },
  { href: "/watchlist", label: "Watchlist", icon: ICONS.eye, badgeKey: "watchlist" as const },
  { href: "/digest", label: "Digest", icon: ICONS.doc },
];
```
to:
```tsx
const LINKS = [
  { href: "/", label: "Portfolio", icon: ICONS.portfolio },
  { href: "/transactions", label: "Transactions", icon: ICONS.tx },
  { href: "/watchlist", label: "Watchlist", icon: ICONS.eye, badgeKey: "watchlist" as const },
  { href: "/digest", label: "Digest", icon: ICONS.doc },
  { href: "/settings", label: "Settings", icon: ICONS.gear },
];
```

- [ ] **Step 11: Write `app/settings/actions.ts`**

```ts
"use server";
import { revalidatePath } from "next/cache";
import { updateSettings, type Settings } from "../../lib/core/index.js";

export async function saveSettings(formData: FormData) {
  updateSettings({
    theme: formData.get("theme") as Settings["theme"],
    accentColor: String(formData.get("accentColor")),
    defaultPriceHistoryRange: formData.get("defaultPriceHistoryRange") as Settings["defaultPriceHistoryRange"],
    dateFormat: formData.get("dateFormat") as Settings["dateFormat"],
  });
  revalidatePath("/", "layout");
}
```

- [ ] **Step 12: Write `app/settings/page.tsx`**

Every other page in this app that reads live server state (`app/page.tsx`, `app/digest/page.tsx`,
`app/transactions/page.tsx`, `app/watchlist/page.tsx`, `app/ticker/[symbol]/page.tsx`) declares
`export const dynamic = "force-dynamic";` to stop Next statically prerendering it at build time —
`app/settings/page.tsx` needs the same, or it gets baked into a static page at whatever
`settings.json` (or its absence) happened to look like at build time, and won't reliably reflect
settings changed via the CLI/MCP while the server is running:

```tsx
import { readSettings } from "../../lib/core/index.js";
import { saveSettings } from "./actions";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const s = readSettings();
  return (
    <div className="grid" style={{ gap: 20 }}>
      <div>
        <div className="page-title">Settings</div>
        <div className="page-sub">Personal preferences — shared by the dashboard, MCP, and the CLI.</div>
      </div>
      <form action={saveSettings} className="panel panel-pad formcard">
        <label className="field">
          Theme
          <select name="theme" defaultValue={s.theme}>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>
        <label className="field">
          Accent color
          <input type="color" name="accentColor" defaultValue={s.accentColor} />
        </label>
        <label className="field">
          Default ticker chart range
          <select name="defaultPriceHistoryRange" defaultValue={s.defaultPriceHistoryRange}>
            <option value="1W">1 week</option>
            <option value="1M">1 month</option>
            <option value="3M">3 months</option>
            <option value="6M">6 months</option>
            <option value="1Y">1 year</option>
            <option value="max">Max</option>
          </select>
        </label>
        <label className="field">
          Date format
          <select name="dateFormat" defaultValue={s.dateFormat}>
            <option value="en-GB">09 Jul 2026</option>
            <option value="iso">2026-07-09</option>
            <option value="en-US">Jul 09, 2026</option>
          </select>
        </label>
        <button className="btn primary" type="submit">Save settings</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 13: Run the full suite, typecheck, and build**

```bash
pnpm test
pnpm typecheck
pnpm build
```
Expected: 107 tests still pass (no test changed behavior in this task beyond `format.test.ts`'s new case from Step 1, already counted); typecheck clean; build succeeds, and the route table includes `/settings`.

- [ ] **Step 14: Commit**

```bash
git add app/ components/ lib/format.ts test/format.test.ts
git status --short
git commit -m "feat: add settings page, move theme/accent server-side, wire dateFormat and default chart range"
```

---

### Task 5: End-to-end verification + README

**Files:** `README.md` (modify). No code changes — this task is verification plus documenting the finished feature.

- [ ] **Step 1: Full test + typecheck + build**

```bash
pnpm test
pnpm typecheck
pnpm build
```
Expected: 107 tests pass; typecheck clean; build succeeds with `/settings` in the route table.

- [ ] **Step 2: Manually exercise the settings page in the browser**

```bash
pnpm dev
```
Open http://localhost:3000/settings. Change theme to Light, pick a different accent color, set
default chart range to something other than Max, save. Confirm: the whole app is now light-themed
with the new accent color visible in the 52-week range bar gradient; navigating to a ticker page
opens its chart pre-zoomed to the chosen range instead of full history; reloading `/` does **not**
flash dark before showing light (this is the regression check for the theme-flash fix). Switch back
to Dark/Max before moving on, so the demo data's visual defaults aren't left changed.

- [ ] **Step 3: Manually exercise settings over MCP and the CLI, end to end**

With the dev server running from Step 2:

```bash
pnpm egx settings
pnpm egx set-settings --theme light --accent-color "#3b82f6"
pnpm egx settings
curl -s -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_settings","arguments":{}}}'
```
Expected: the CLI's second `settings` call shows the updated `theme`/`accentColor`; the MCP curl
call returns the same values (proving CLI and MCP writes/reads share the exact same
`data/settings.json` the web app itself reads). Reset back to defaults afterward:
```bash
pnpm egx set-settings --theme dark --accent-color "#34d399" --default-price-history-range max --date-format en-GB
```

- [ ] **Step 4: Update README**

Add a `## Settings` section (after `## CLI`, before `## Documentation`) describing the four v1
settings, that they're shared across the dashboard/MCP/CLI, and the `data/settings.json` /
`EGX_SETTINGS_PATH` file location. Update the CLI command table to include `settings` and
`set-settings`. Update the "Tests" line's test count to 107.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: document the settings API and settings page"
```
