# Per-Ticker Detail Page — Design

**Date:** 2026-07-03
**Status:** Approved (design)
**App:** `apps/web` (Next.js 16, over `@egx/core`)

## Purpose

A detail page per holding at `/ticker/[symbol]` showing a large interactive price chart, the user's position, this ticker's transactions, and stats derived purely from stored EOD data. No paid EODHD data (fundamentals/news/intraday) in this version.

## Scope

- **In:** reusable price chart (presets + drag-zoom + hover), position panel, transaction history, derived stats (52w hi/lo, returns, volatility, max drawdown, volume), a "View details →" link from the holdings table's expanded row.
- **Out (deferred):** fundamentals, news, intraday, technical indicators (all paid EODHD). Not gated/stubbed — simply absent.

## Architecture

- **`components/PriceChart.tsx`** — extract the existing `AreaChart` + range presets (1M/3M/6M/1Y/Max) + drag-to-zoom + double-click reset + hover crosshair/tooltip from `HoldingsTable.tsx` into a standalone client component. Props: `points: SparkPoint[]`, `id: string`, `height?: number` (default 150). `HoldingsTable` renders it inline at 150; the ticker page at ~320.
- **`app/ticker/[symbol]/page.tsx`** — server component, `export const dynamic = "force-dynamic"`. Loads `tickerDetail(symbol)`, renders header + chart + position + stats + transactions. `symbol` comes from the route param (URL-decoded; e.g. `COMI.EGX`).
- **`lib/ticker.ts`** (server-only) — `tickerDetail(symbol: string): TickerDetail | null`. Returns null if the security doesn't exist. Assembles: security meta, full price history (`SparkPoint[]` + volumes), position (from `getPortfolioSummary().holdings`, may be null if not held), this ticker's transactions, and `computeStats`.
- **`lib/stats.ts`** (pure, unit-tested) — `computeStats(bars: {date,close,volume}[]): TickerStats`.
- **`HoldingsTable.tsx`** — the expanded detail panel gains a `View details →` link to `/ticker/${encodeURIComponent(h.ticker)}`; it now imports `PriceChart` instead of defining the chart inline.

## Data flow

Page (server) → `tickerDetail(symbol)` [uses `getDb()` + core: `getPriceHistory`, `listTransactions`, `getPortfolioSummary`, `getSecurity`] → serializable props → server-rendered sections. `PriceChart` is the only client component (hover/zoom state). All money stays integer piasters until display (`egp`/`pct` in `lib/format`).

## Types

```ts
// lib/stats.ts
export interface StatBar { date: string; close: number; volume: number } // close = piasters
export interface TickerStats {
  high52: number | null; low52: number | null;           // piasters, over last ~252 bars
  pctFromHigh: number | null; pctFromLow: number | null; // decimal fraction
  returns: { m1: number|null; m3: number|null; m6: number|null; ytd: number|null; y1: number|null }; // fractions
  volatilityAnnual: number | null;                       // fraction (stdev daily × √252)
  maxDrawdown: number | null;                            // fraction, negative
  avgVolume: number | null; lastVolume: number | null;
}

// lib/ticker.ts
export interface TickerDetail {
  ticker: string; name: string; sector: string | null;
  lastClose: number | null; lastDate: string | null;
  dayChangePct: number | null;
  position: HoldingValuation | null;   // from portfolio summary; null if not held
  history: SparkPoint[];               // full stored series (oldest→newest)
  txns: Transaction[];
  stats: TickerStats;
}
```

## Stats math (from stored EOD only)

Series sorted ascending by date; `L` = last index.
- **Returns** over `N` trading days: `(close[L] − close[L−N]) / close[L−N]`; null if `L−N < 0`. Periods: m1=21, m3=63, m6=126, y1=252. **YTD**: return vs the last close of the previous year (or first bar of current year if none prior).
- **Volatility (annualized)**: `stdev(daily returns) × sqrt(252)`, where daily return `r_i = close[i]/close[i−1] − 1`. Null if < 2 bars.
- **Max drawdown**: iterate closes tracking running peak; `dd = (close − peak)/peak`; result = min `dd` (≤ 0).
- **52-week high/low**: max/min close over the last 252 bars (or all if fewer). `pctFromHigh = (last − high52)/high52`, `pctFromLow = (last − low52)/low52`.
- **Volume**: `avgVolume` = mean of the window's volumes; `lastVolume` = final bar's volume.

## Error handling / edge cases

- **Unknown symbol** (no `securities` row): page renders a "not found" state with a back link.
- **No price history**: chart shows "Not enough price history yet"; stats fields null → rendered as "—".
- **Not held** (watchlist-only): `position` null → position panel shows "Not in your portfolio"; chart + stats still render.
- **Insufficient data for a period**: that return is null → "—" (e.g. only 60 bars → 6M/1Y show "—").
- Volume may be 0 for manually-entered bars → shown as-is.

## Testing

- **`lib/stats.ts`**: vitest with a hand-built series → assert exact returns, volatility, drawdown, 52w hi/lo, volume against pre-computed values. Cover the insufficient-data (null) paths.
- **PriceChart / page**: build smoke (`next build`) — presentational; hover/zoom verified by driving the app.

## Out of scope (future)

Fundamentals, news, intraday, technical indicators (paid EODHD); value/price axis + gridlines on the chart; comparison overlays.
