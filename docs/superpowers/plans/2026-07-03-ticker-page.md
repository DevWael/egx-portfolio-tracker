# Per-Ticker Detail Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A `/ticker/[symbol]` page with a large interactive price chart, the user's position, transaction history, and stats derived purely from stored EOD data.

**Architecture:** Extract the existing holdings chart into a reusable `PriceChart` client component; add a server route that assembles per-ticker detail via a server-only `lib/ticker.ts`; compute stats in a pure, unit-tested `lib/stats.ts`.

**Tech Stack:** Next.js 16 (App Router, webpack), React 19, TypeScript, `@egx/core`, vitest.

## Global Constraints

- Money is **integer piasters** in core/data; convert to EGP only at display via `lib/format` (`egp`, `pct`). Percentages are decimal fractions.
- DB access is **server-only**: `lib/db.ts`, `lib/data.ts`, `lib/ticker.ts` start with `import "server-only";`. `PriceChart` is a **client** component (`"use client"`).
- Pages that read the DB use `export const dynamic = "force-dynamic";`.
- ESM `.js` extensions on relative imports. App builds on webpack (`--webpack` scripts already set) — don't change bundler config.
- Conventional Commits; **NO AI attribution** in commit messages.
- Existing types (import, don't redefine): `SparkPoint { date: string; close: number }` and `HoldingRow` from `@/lib/metrics`; `HoldingValuation`, `Transaction`, `PriceBar` from `@egx/core`.

---

### Task 1: Extract the reusable `PriceChart` component

Move the chart (area + range presets + drag-zoom + hover tooltip) out of `HoldingsTable.tsx` into a standalone widget so the ticker page can reuse it at a larger size. Pure refactor — inline behavior unchanged.

**Files:**
- Create: `apps/web/components/PriceChart.tsx`
- Modify: `apps/web/components/HoldingsTable.tsx`

**Interfaces:**
- Produces: `export function PriceChart(props: { points: SparkPoint[]; id: string; height?: number }): JSX.Element` — self-contained: owns window/preset state, drag-zoom, hover; renders header (Last N days + range presets + % change), the area chart, and a footer (start date / latest). `height` defaults to 150.
- Consumes: `SparkPoint` from `@/lib/metrics`; `egp`, `pct` from `@/lib/format`.

- [ ] **Step 1: Create `PriceChart.tsx`**

`apps/web/components/PriceChart.tsx`:
```tsx
"use client";
import { useRef, useState } from "react";
import { egp, pct } from "@/lib/format";
import type { SparkPoint } from "@/lib/metrics";

function fmtDate(d: string): string {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const RANGES: [string, number | null][] = [["1M", 30], ["3M", 90], ["6M", 180], ["1Y", 365], ["Max", null]];

function Area({ points, up, id, height, onZoom, onReset }: {
  points: SparkPoint[]; up: boolean; id: string; height: number;
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
            <span className="muted">{fmtDate(points[hi!].date)}</span> · <b>{egp(values[hi!])}</b>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function PriceChart({ points, id, height = 150 }: { points: SparkPoint[]; id: string; height?: number }) {
  const [win, setWin] = useState<[number, number] | null>(null);
  const s = win ? win[0] : 0;
  const e = win ? win[1] : points.length - 1;
  const pts = points.slice(s, e + 1);
  const first = pts[0]?.close;
  const lastC = pts[pts.length - 1]?.close;
  const chg = pts.length >= 2 && first > 0 ? (lastC - first) / first : null;
  const isFull = !win || (win[0] === 0 && win[1] === points.length - 1);
  const presetActive = (days: number | null) => days === null ? isFull : !!win && win[1] === points.length - 1 && win[0] === Math.max(0, points.length - days);
  const setPreset = (days: number | null) => setWin(days === null ? null : [Math.max(0, points.length - days), points.length - 1]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 12, flexWrap: "wrap" }}>
        <span className="muted" style={{ fontSize: 12 }}>Last {pts.length} day{pts.length === 1 ? "" : "s"}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="rng">{RANGES.map(([label, days]) => <button key={label} className={presetActive(days) ? "on" : ""} onClick={() => setPreset(days)}>{label}</button>)}</div>
          {chg !== null ? <span className={chg >= 0 ? "gain" : "loss"} style={{ fontSize: 13, fontWeight: 600 }}>{pct(chg)}</span> : null}
        </div>
      </div>
      <Area points={pts} up={(chg ?? 0) >= 0} id={id} height={height} onZoom={(la, lb) => setWin([s + la, s + lb])} onReset={() => setWin(null)} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <span className="muted" style={{ fontSize: 12 }}>{pts.length >= 1 ? fmtDate(pts[0].date) : ""}</span>
        <span className="muted" style={{ fontSize: 12 }}>{pts.length >= 1 ? `${fmtDate(pts[pts.length - 1].date)} · ${egp(lastC)}` : ""}</span>
      </div>
      <div className="muted" style={{ fontSize: 11, marginTop: 4, opacity: 0.7 }}>Drag to zoom · double-click to reset</div>
    </div>
  );
}
```

- [ ] **Step 2: Simplify `HoldingsTable.tsx` to use `PriceChart`**

Replace the entire contents of `apps/web/components/HoldingsTable.tsx` with:
```tsx
"use client";
import { useState } from "react";
import { egp, pct } from "@/lib/format";
import { PriceChart } from "@/components/PriceChart";
import type { HoldingRow } from "@/lib/metrics";

export function HoldingsTable({ holdings }: { holdings: HoldingRow[] }) {
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
            <tbody>{holdings.map((h) => <RowGroup key={h.ticker} h={h} isOpen={open === h.ticker} onToggle={() => setOpen(open === h.ticker ? null : h.ticker)} />)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RowGroup({ h, isOpen, onToggle }: { h: HoldingRow; isOpen: boolean; onToggle: () => void }) {
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
                <PriceChart points={h.spark} id={h.ticker.replace(/\W/g, "")} />
                <a href={`/ticker/${encodeURIComponent(h.ticker)}`} className="btn" style={{ marginTop: 12 }}>View details →</a>
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
(This both extracts the chart AND adds the "View details →" link required later — the link href is valid even before the route exists; Task 3 makes it resolve.)

- [ ] **Step 3: Typecheck + build**

Run: `pnpm --filter @egx/web typecheck && pnpm --filter @egx/web build`
Expected: both succeed. The inline chart behaves exactly as before (presets, drag-zoom, hover).

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/PriceChart.tsx apps/web/components/HoldingsTable.tsx
git commit -m "refactor(web): extract reusable PriceChart; add View details link"
```

---

### Task 2: `lib/stats.ts` — derived stats (pure, TDD)

**Files:**
- Create: `apps/web/lib/stats.ts`
- Test: `apps/web/test/stats.test.ts`

**Interfaces:**
- Produces:
  - `export interface StatBar { date: string; close: number; volume: number }`
  - `export interface TickerStats { high52: number|null; low52: number|null; pctFromHigh: number|null; pctFromLow: number|null; returns: { m1: number|null; m3: number|null; m6: number|null; ytd: number|null; y1: number|null }; volatilityAnnual: number|null; maxDrawdown: number|null; avgVolume: number|null; lastVolume: number|null }`
  - `export function returnOver(closes: number[], n: number): number | null`
  - `export function annualizedVol(closes: number[]): number | null`
  - `export function maxDrawdown(closes: number[]): number | null`
  - `export function computeStats(bars: StatBar[]): TickerStats`
- Consumes: nothing (pure).

- [ ] **Step 1: Write the failing test**

`apps/web/test/stats.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { returnOver, annualizedVol, maxDrawdown, computeStats } from "../lib/stats.js";

describe("stats helpers", () => {
  it("returnOver computes N-back return or null", () => {
    const c = [100, 110, 105, 120];
    expect(returnOver(c, 1)).toBeCloseTo((120 - 105) / 105, 6);
    expect(returnOver(c, 3)).toBeCloseTo(0.2, 6);
    expect(returnOver(c, 4)).toBeNull();
  });
  it("annualizedVol is 0 for constant-growth and positive for varying", () => {
    expect(annualizedVol([100, 110, 121])).toBeCloseTo(0, 6); // returns [0.1, 0.1] -> stdev 0
    expect(annualizedVol([100])).toBeNull();
    expect(annualizedVol([100, 110, 105, 120])!).toBeGreaterThan(0);
  });
  it("maxDrawdown finds the largest peak-to-trough drop (<= 0)", () => {
    expect(maxDrawdown([100, 110, 105, 120])!).toBeCloseTo((105 - 110) / 110, 6);
    expect(maxDrawdown([100, 90, 80])!).toBeCloseTo((80 - 100) / 100, 6);
    expect(maxDrawdown([])).toBeNull();
  });
});

describe("computeStats", () => {
  const bars = [
    { date: "2026-06-29", close: 100, volume: 10 },
    { date: "2026-06-30", close: 110, volume: 20 },
    { date: "2026-07-01", close: 105, volume: 30 },
    { date: "2026-07-02", close: 120, volume: 40 },
  ];
  it("computes 52w hi/lo, pct-from, volume", () => {
    const s = computeStats(bars);
    expect(s.high52).toBe(120);
    expect(s.low52).toBe(100);
    expect(s.pctFromHigh).toBeCloseTo(0, 6);
    expect(s.pctFromLow).toBeCloseTo(0.2, 6);
    expect(s.lastVolume).toBe(40);
    expect(s.avgVolume).toBeCloseTo(25, 6);
  });
  it("returns nulls for periods with insufficient history", () => {
    const s = computeStats(bars);
    expect(s.returns.m1).toBeNull(); // needs 21 bars
    expect(s.returns.y1).toBeNull();
  });
  it("empty input yields all nulls", () => {
    const s = computeStats([]);
    expect(s.high52).toBeNull();
    expect(s.returns.m3).toBeNull();
    expect(s.volatilityAnnual).toBeNull();
    expect(s.avgVolume).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @egx/web test stats`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/stats.ts`**

`apps/web/lib/stats.ts`:
```ts
export interface StatBar { date: string; close: number; volume: number }
export interface TickerStats {
  high52: number | null; low52: number | null;
  pctFromHigh: number | null; pctFromLow: number | null;
  returns: { m1: number | null; m3: number | null; m6: number | null; ytd: number | null; y1: number | null };
  volatilityAnnual: number | null;
  maxDrawdown: number | null;
  avgVolume: number | null; lastVolume: number | null;
}

export function returnOver(closes: number[], n: number): number | null {
  const L = closes.length - 1;
  const base = closes[L - n];
  if (L - n < 0 || !base) return null;
  return (closes[L] - base) / base;
}

export function annualizedVol(closes: number[]): number | null {
  if (closes.length < 2) return null;
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) if (closes[i - 1] > 0) rets.push(closes[i] / closes[i - 1] - 1);
  if (rets.length < 2) return null;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, r) => a + (r - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252);
}

export function maxDrawdown(closes: number[]): number | null {
  if (closes.length === 0) return null;
  let peak = closes[0], mdd = 0;
  for (const c of closes) {
    if (c > peak) peak = c;
    if (peak > 0) mdd = Math.min(mdd, (c - peak) / peak);
  }
  return mdd;
}

export function computeStats(bars: StatBar[]): TickerStats {
  const empty: TickerStats = {
    high52: null, low52: null, pctFromHigh: null, pctFromLow: null,
    returns: { m1: null, m3: null, m6: null, ytd: null, y1: null },
    volatilityAnnual: null, maxDrawdown: null, avgVolume: null, lastVolume: null,
  };
  if (bars.length === 0) return empty;

  const closes = bars.map((b) => b.close);
  const L = closes.length - 1;
  const last = closes[L];

  const win = bars.slice(-252);
  const wCloses = win.map((b) => b.close);
  const high52 = Math.max(...wCloses);
  const low52 = Math.min(...wCloses);

  // YTD: baseline = last close of the previous year, else the first bar
  const year = bars[L].date.slice(0, 4);
  let ytdBase = closes[0];
  for (let i = L; i >= 0; i--) { if (bars[i].date.slice(0, 4) < year) { ytdBase = closes[i]; break; } }
  const ytd = ytdBase > 0 ? (last - ytdBase) / ytdBase : null;

  const vols = win.map((b) => b.volume);
  return {
    high52, low52,
    pctFromHigh: high52 > 0 ? (last - high52) / high52 : null,
    pctFromLow: low52 > 0 ? (last - low52) / low52 : null,
    returns: {
      m1: returnOver(closes, 21), m3: returnOver(closes, 63),
      m6: returnOver(closes, 126), y1: returnOver(closes, 252), ytd,
    },
    volatilityAnnual: annualizedVol(closes),
    maxDrawdown: maxDrawdown(closes),
    avgVolume: vols.length ? vols.reduce((a, b) => a + b, 0) / vols.length : null,
    lastVolume: bars[L].volume,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @egx/web test stats`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/stats.ts apps/web/test/stats.test.ts
git commit -m "feat(web): add pure derived-stats module (returns, volatility, drawdown, 52w)"
```

---

### Task 3: `lib/ticker.ts` + the `/ticker/[symbol]` page

**Files:**
- Create: `apps/web/lib/ticker.ts`
- Create: `apps/web/app/ticker/[symbol]/page.tsx`

**Interfaces:**
- Consumes: `getDb` (`@/lib/db`); core `getSecurity`, `getPriceHistory`, `listTransactions`, `getPortfolioSummary`; `computeStats`, `StatBar`, `TickerStats` (`@/lib/stats`); `SparkPoint` (`@/lib/metrics`); `PriceChart` (`@/components/PriceChart`); `egp`, `pct` (`@/lib/format`).
- Produces: `export interface TickerDetail { ... }` and `export function tickerDetail(symbol: string): TickerDetail | null` in `lib/ticker.ts`.

- [ ] **Step 1: Create `lib/ticker.ts`**

`apps/web/lib/ticker.ts`:
```ts
import "server-only";
import { getSecurity, getPriceHistory, listTransactions, getPortfolioSummary, type HoldingValuation, type Transaction } from "@egx/core";
import { getDb } from "./db.js";
import { computeStats, type TickerStats } from "./stats.js";
import type { SparkPoint } from "./metrics.js";

export interface TickerDetail {
  ticker: string;
  name: string;
  sector: string | null;
  lastClose: number | null;
  lastDate: string | null;
  position: HoldingValuation | null;
  history: SparkPoint[];
  txns: Transaction[];
  stats: TickerStats;
}

export function tickerDetail(symbol: string): TickerDetail | null {
  const db = getDb();
  const sec = getSecurity(db, symbol);
  if (!sec) return null;
  const bars = getPriceHistory(db, symbol, "0000-01-01", "9999-12-31");
  const last = bars[bars.length - 1] ?? null;
  const position = getPortfolioSummary(db).holdings.find((h) => h.ticker === symbol) ?? null;
  return {
    ticker: symbol,
    name: sec.name,
    sector: sec.sector,
    lastClose: last ? last.close : null,
    lastDate: last ? last.date : null,
    position,
    history: bars.map((b) => ({ date: b.date, close: b.close })),
    txns: listTransactions(db, symbol),
    stats: computeStats(bars.map((b) => ({ date: b.date, close: b.close, volume: b.volume }))),
  };
}
```

- [ ] **Step 2: Create the page**

`apps/web/app/ticker/[symbol]/page.tsx`:
```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { tickerDetail } from "@/lib/ticker";
import { egp, pct } from "@/lib/format";
import { PriceChart } from "@/components/PriceChart";

export const dynamic = "force-dynamic";

function Stat({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return <div className="panel stat"><div className="k">{label}</div><div className={`v ${cls ?? ""}`} style={{ fontSize: 18 }}>{value}</div></div>;
}
const sign = (n: number | null) => (n === null ? "" : n > 0 ? "gain" : n < 0 ? "loss" : "");

export default async function TickerPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const d = tickerDetail(decodeURIComponent(symbol));
  if (!d) notFound();
  const s = d.stats;
  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="row-flex" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="page-title">{d.ticker}</div>
          <div className="page-sub">{d.name}{d.sector ? ` · ${d.sector}` : ""}{d.lastClose !== null ? ` · ${egp(d.lastClose)}` : ""}</div>
        </div>
        <Link href="/" className="btn">← Portfolio</Link>
      </div>

      <div className="panel panel-pad">
        <PriceChart points={d.history} id={d.ticker.replace(/\W/g, "")} height={320} />
      </div>

      <div className="grid stat-grid">
        {d.position ? (
          <>
            <Stat label="Your qty" value={d.position.qty.toLocaleString()} />
            <Stat label="Avg cost" value={egp(d.position.avgCost)} />
            <Stat label="Market value" value={egp(d.position.marketValue)} />
            <Stat label="Unrealized P&L" value={`${egp(d.position.unrealizedPnl)} (${pct(d.position.unrealizedPnlPct)})`} cls={sign(d.position.unrealizedPnl)} />
          </>
        ) : (
          <div className="panel stat"><div className="k">Position</div><div className="v" style={{ fontSize: 16 }}>Not in your portfolio</div></div>
        )}
      </div>

      <div className="grid stat-grid">
        <Stat label="52-week high" value={egp(s.high52)} />
        <Stat label="52-week low" value={egp(s.low52)} />
        <Stat label="From high" value={pct(s.pctFromHigh)} cls={sign(s.pctFromHigh)} />
        <Stat label="From low" value={pct(s.pctFromLow)} cls={sign(s.pctFromLow)} />
        <Stat label="Return 1M" value={pct(s.returns.m1)} cls={sign(s.returns.m1)} />
        <Stat label="Return 3M" value={pct(s.returns.m3)} cls={sign(s.returns.m3)} />
        <Stat label="Return 6M" value={pct(s.returns.m6)} cls={sign(s.returns.m6)} />
        <Stat label="Return YTD" value={pct(s.returns.ytd)} cls={sign(s.returns.ytd)} />
        <Stat label="Return 1Y" value={pct(s.returns.y1)} cls={sign(s.returns.y1)} />
        <Stat label="Volatility (ann.)" value={pct(s.volatilityAnnual)} />
        <Stat label="Max drawdown" value={pct(s.maxDrawdown)} cls={sign(s.maxDrawdown)} />
        <Stat label="Avg volume" value={s.avgVolume === null ? "—" : Math.round(s.avgVolume).toLocaleString()} />
        <Stat label="Last volume" value={s.lastVolume === null ? "—" : s.lastVolume.toLocaleString()} />
      </div>

      <div className="panel">
        <div className="panel-head">Transaction history <span className="hint">{d.txns.length} entr{d.txns.length === 1 ? "y" : "ies"}</span></div>
        <div className="overflow-x">
          <table>
            <thead><tr><th>Date</th><th>Side</th><th>Qty</th><th>Price</th><th>Fee</th><th>Note</th></tr></thead>
            <tbody>
              {d.txns.length === 0 ? <tr><td colSpan={6} className="empty">No transactions.</td></tr> : d.txns.map((t) => (
                <tr key={t.id}>
                  <td>{t.tradedAt}</td>
                  <td><span className={`tag ${t.side === "buy" ? "crossed" : "off"}`}>{t.side}</span></td>
                  <td>{t.qty.toLocaleString()}</td><td>{egp(t.price)}</td><td>{egp(t.fee)}</td>
                  <td className="dim" style={{ textAlign: "left" }}>{t.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```
Note: `pct(null)` and `egp(null)` already render `"—"` (see `lib/format`), so null stats display cleanly.

- [ ] **Step 3: Typecheck + build**

Run: `pnpm --filter @egx/web typecheck && pnpm --filter @egx/web build`
Expected: both succeed; route `/ticker/[symbol]` shows as dynamic.

- [ ] **Step 4: Drive the route end-to-end**

Seed is already in the live DB. Start the app against the live DB and hit a held ticker:
```bash
cd apps/web
( pnpm start >/tmp/egx-ticker.log 2>&1 & ) ; 
for i in $(seq 1 30); do curl -sf -o /tmp/egx-ticker.html -w "%{http_code}" "http://localhost:3000/ticker/COMI.EGX" && break; sleep 1; done
pkill -f "next start" || true
```
Expected: HTTP 200; the HTML contains the ticker name and stat labels (e.g. "52-week high", "Return 1Y", "Transaction history"). Also verify an unknown symbol 404s: `curl -o /dev/null -w "%{http_code}" http://localhost:3000/ticker/NOPE.EGX` → `404`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/ticker.ts apps/web/app/ticker
git commit -m "feat(web): per-ticker detail page (chart, position, derived stats, transactions)"
```

---

## Self-Review

**Spec coverage:**
- Reusable `PriceChart` (presets + drag-zoom + hover), inline at 150 / page at 320 → Task 1. ✓
- `/ticker/[symbol]` route, `force-dynamic`, server component → Task 3. ✓
- `lib/ticker.ts` `tickerDetail` (meta, history, position, txns, stats; null on unknown symbol) → Task 3. ✓
- `lib/stats.ts` pure + tested (52w hi/lo, returns m1/m3/m6/ytd/y1, annualized vol, max drawdown, avg/last volume; null on insufficient data) → Task 2. ✓
- Page sections: header, big chart, position (or "Not in your portfolio"), stats grid, transactions → Task 3. ✓
- "View details →" link from holdings expanded row → Task 1 (Step 2). ✓
- Edge cases: unknown symbol → `notFound()` (404); no history → chart "Not enough…" + null stats → "—"; not held → "Not in your portfolio" → Task 3 + `computeStats` null paths (Task 2). ✓
- Money in piasters, display via `egp`/`pct`; server-only libs; `force-dynamic`; ESM `.js`; webpack unchanged → Global Constraints, honored per task. ✓

**Placeholder scan:** No TBD/TODO; every step has complete code. ✓

**Type consistency:** `SparkPoint` imported from `@/lib/metrics` (not redefined); `StatBar`/`TickerStats` defined in Task 2 and consumed in Task 3; `PriceChart` signature `{ points, id, height? }` identical in Task 1 (definition) and Tasks 1/3 (uses); `tickerDetail` returns the `TickerDetail` shape the page reads. ✓

**Out of scope (intentional):** fundamentals, news, intraday, technical indicators, price axis/gridlines — deferred per spec.
