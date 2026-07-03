# EGX Portfolio Tracker

A personal, single-user tool to track equity positions on the **Egyptian Exchange (EGX)**, value them against end-of-day prices from [EODHD](https://eodhd.com), and manage/analyze the portfolio from **Claude Code** via an MCP server.

> **Not a trading platform.** EGX has no public retail trading API (neither the exchange nor brokers like Thndr, EFG Hermes, or Beltone expose one). This is a **tracker + advisory/analysis** tool — you place orders manually in your broker app. Buy/sell suggestions are for personal use only.

## Status

| Plan | Scope | State |
|------|-------|-------|
| **1. `packages/core`** | SQLite data layer, repositories, portfolio math, alerts, digest, EODHD client | ✅ **Complete** — 50 tests |
| **3. `apps/web`** | Next.js dashboard + per-ticker pages | ✅ **Complete** — runnable, 11 tests |
| **2. `apps/mcp`** | MCP server exposing core as tools for Claude Code | ✅ **Complete** |

The EODHD client is verified end-to-end against **live EGX data** (real historical daily closes for `.EGX` tickers).

## Features (web app)

- **Dashboard** — market value, unrealized/realized P&L, day change, positions, holdings table, allocation-by-sector donut, top movers, daily digest, "prices as of" stamp.
- **Per-ticker pages** (`/ticker/[symbol]`) — a large interactive price chart with:
  - period presets (**1W / 1M / 3M / 6M / 1Y / Max**), **drag-to-zoom**, double-click reset, and a **hover crosshair + date/price tooltip**;
  - a **52-week (period-synced) range bar** showing where the current price sits (% of range, from-low/from-high);
  - **derived stats** computed from stored prices — returns (1M/3M/6M/YTD/1Y), annualized volatility, max drawdown, 52-week high/low, volume;
  - your position + this ticker's transaction history. The period control drives the chart **and** the range + risk stats together.
- **Transactions** — add/delete buys & sells (holdings and P&L are derived from these).
- **Watchlist** — price-target alerts (above/below), auto-marked "crossed" at the latest close.
- **Load demo** (confirms first) and **Refresh prices** (live EODHD when a key is set).
- Dark/light theme.

## Architecture

TypeScript pnpm-workspace monorepo. All logic lives in `packages/core`; the `apps/*` shells are thin presenters over it.

```
packages/core/       the brain — no UI, no MCP knowledge
  db/                SQLite (better-sqlite3), inlined schema, migrations, WAL
  repositories/      securities, transactions, prices, watchlist
  portfolio/         weighted-avg-cost holdings, valuation, summary
  alerts/            evaluate watchlist vs latest close
  digest/            daily summary (value, alerts, top movers)
  eodhd/             EODHD API client (injected fetch; live-verified)
  services/          price-sync
apps/web/            Next.js 16 App Router (React 19) — dashboard + ticker pages
  app/               routes: / · /transactions · /watchlist · /digest · /ticker/[symbol]
  components/        PriceChart, HoldingsTable, TickerChartStats, StatCards, …
  lib/               db (server-only singleton), data, metrics, stats, ticker, format
apps/mcp/            stdio MCP server for Claude Code (tools over core; shares the web DB)
  src/               db (shared), money (EGP↔piasters), tools (read+write), server, index
docs/                design specs, implementation plans, UI brief + mockup
```

**Key decisions**

- **Transactions are the source of truth**; holdings are derived (weighted-average cost; buy fees add to basis, sell fees reduce realized proceeds).
- **All money is integer piasters** (1 EGP = 100 piasters) — never floating point, to avoid drift. Converted to EGP only at display.
- **End-of-day prices.** EODHD offers no real-time feed for EGX (~15–20 min delayed at best), so the tool values against the latest close and stamps everything "prices as of `<date>`".
- **Graceful degradation.** A failed price fetch never blocks the app; it falls back to the last stored close.
- **Server-only DB access.** `better-sqlite3` runs only on the server; the web app builds on webpack (Turbopack can't resolve core's `.js`→`.ts` import convention).

## Tech stack

Node 20+ · TypeScript 5 · pnpm 9+ · Next.js 16 · React 19 · better-sqlite3 · vitest

## Getting started

```bash
pnpm install
pnpm --filter @egx/web dev     # http://localhost:3000
```

Open http://localhost:3000. Click **Load demo** for a sample portfolio, or add your own transactions and watchlist alerts. Data persists to a local SQLite file at `apps/web/data/egx.db` — created automatically on first run, git-ignored, override with `EGX_DB_PATH`. The DB is **local only** and never committed.

### Live prices

Set an [EODHD API key](https://eodhd.com) in `apps/web/.env.local` (git-ignored):

```
EODHD_API_KEY=your_key_here
```

Then click **Refresh prices** to pull up to a year of daily history for your tickers. Without a key, tracking and demo data still work fully. EGX tickers use the `CODE.EGX` format (e.g. `COMI.EGX` for Commercial International Bank). Free tier: 1 year of history, 20 calls/day.

## MCP server (Claude Code)

Drive the portfolio by chatting in Claude Code. The MCP server shares the web app's database.

```bash
claude mcp add egx -- pnpm -C /absolute/path/to/EGX --filter @egx/mcp start
```

Set `EODHD_API_KEY` (for `refresh_prices`) and optionally `EGX_DB_PATH` in the environment Claude Code launches with. Then ask things like *"how's my portfolio?"*, *"record a buy of 100 COMI.EGX at 84.15"*, or *"any alerts crossed?"* — tools speak **EGP**. Available tools: `list_positions`, `get_portfolio_summary`, `list_transactions`, `get_price_history`, `list_watchlist`, `get_triggered_alerts`, `record_transaction`, `delete_transaction`, `set_alert`, `upsert_security`, `refresh_prices`.

### Tests & core demo

```bash
pnpm -r test                        # core (50) + web (11) + mcp (15)
pnpm --filter @egx/core typecheck
pnpm --filter @egx/core demo        # terminal demo of the engine (no key/network)
```

## Documentation

- Specs: [core design](docs/superpowers/specs/2026-07-03-egx-portfolio-tracker-design.md) · [ticker page](docs/superpowers/specs/2026-07-03-ticker-page-design.md) · [MCP server](docs/superpowers/specs/2026-07-04-mcp-server-design.md)
- Plans: [core](docs/superpowers/plans/2026-07-03-egx-tracker-core.md) · [web](docs/superpowers/plans/2026-07-03-egx-tracker-web.md) · [ticker page](docs/superpowers/plans/2026-07-03-ticker-page.md) · [MCP server](docs/superpowers/plans/2026-07-04-mcp-server.md)
- UI: [design brief](docs/design/claude-design-brief.md) · [dashboard mockup](docs/design/mockups/egx-folio.html)

## Disclaimer

Personal-use software. Not financial advice, not affiliated with the Egyptian Exchange or EODHD. Providing trading recommendations to others in Egypt may require FRA (Financial Regulatory Authority) licensing — out of scope for this project.
