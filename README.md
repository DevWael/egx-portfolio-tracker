# EGX Portfolio Tracker

A personal, single-user tool to track equity positions on the **Egyptian Exchange (EGX)**, value them against end-of-day prices from [EODHD](https://eodhd.com), and manage/analyze the portfolio from **Claude Code** via an MCP server.

> **Not a trading platform.** EGX has no public retail trading API (neither the exchange nor brokers like Thndr, EFG Hermes, or Beltone expose one). This is a **tracker + advisory/analysis** tool — you place orders manually in your broker app. Buy/sell suggestions are for personal use only.

## Status

Single Next.js app — dashboard, per-ticker pages, and an MCP server (over HTTP) all served from
one process. ✅ **Complete** — 82 tests.

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

Single Next.js app (App Router, React 19) at the repo root. No workspace, no separate packages —
the dashboard and the MCP server are two entry points into the same code, run by the same process.

```
app/                 routes: / · /transactions · /watchlist · /digest · /ticker/[symbol]
  api/mcp/route.ts   MCP server exposed over HTTP (Streamable HTTP, stateless)
components/          PriceChart, HoldingsTable, TickerChartStats, StatCards, …
lib/
  core/              the brain — no UI, no MCP knowledge
    db/              SQLite (better-sqlite3), inlined schema, migrations, WAL
    repositories/    securities, transactions, prices, watchlist
    portfolio/       weighted-avg-cost holdings, valuation, summary
    alerts/          evaluate watchlist vs latest close
    digest/          daily summary (value, alerts, top movers)
    eodhd/           EODHD API client (injected fetch; live-verified)
    services/        price-sync
  mcp/               tools (read+write over lib/core), money (EGP↔piasters), server (McpServer)
  db.ts, data.ts, metrics.ts, stats.ts, ticker.ts, format.ts, backup.ts   web-side data layer
test/                core/, mcp/, plus the web-level unit tests
docs/                design specs, implementation plans, UI brief + mockup
```

**Key decisions**

- **Transactions are the source of truth**; holdings are derived (weighted-average cost; buy fees add to basis, sell fees reduce realized proceeds).
- **All money is integer piasters** (1 EGP = 100 piasters) — never floating point, to avoid drift. Converted to EGP only at display.
- **End-of-day prices.** EODHD offers no real-time feed for EGX (~15–20 min delayed at best), so the tool values against the latest close and stamps everything "prices as of `<date>`".
- **Graceful degradation.** A failed price fetch never blocks the app; it falls back to the last stored close.
- **Server-only DB access.** `better-sqlite3` runs only on the server; the app builds on webpack (Turbopack can't resolve this codebase's `.js`→`.ts` import convention).
- **MCP over HTTP, stateless.** The MCP endpoint (`app/api/mcp/route.ts`) builds a fresh `McpServer` + transport per request rather than a shared instance — required by the SDK for its stateless transport, and it sidesteps any risk of concurrent requests cross-wiring responses. No auth: the app is local-only.

## Tech stack

Node 20+ · TypeScript 5 · pnpm 9+ · Next.js 16 · React 19 · better-sqlite3 · `@modelcontextprotocol/sdk` · vitest

## Getting started

```bash
pnpm install
pnpm dev     # http://localhost:3000
```

Open http://localhost:3000. Click **Load demo** for a sample portfolio, or add your own transactions and watchlist alerts. Data persists to a local SQLite file at `data/egx.db` — created automatically on first run, git-ignored, override with `EGX_DB_PATH`. The DB is **local only** and never committed.

### Live prices

Set an [EODHD API key](https://eodhd.com) in `.env.local` (git-ignored):

```
EODHD_API_KEY=your_key_here
```

Then click **Refresh prices** to pull up to a year of daily history for your tickers. Without a key, tracking and demo data still work fully. EGX tickers use the `CODE.EGX` format (e.g. `COMI.EGX` for Commercial International Bank). Free tier: 1 year of history, 20 calls/day.

## MCP server (Claude Code)

Drive the portfolio by chatting in Claude Code. The MCP server is served over HTTP from the same
app that serves the dashboard — `next dev`/`next start` must be running for it to work:

```bash
claude mcp add --transport http egx http://localhost:3000/api/mcp
```

Set `EODHD_API_KEY` (for `refresh_prices`) and optionally `EGX_DB_PATH` in `.env.local` before starting the app. Then ask things like *"how's my portfolio?"*, *"record a buy of 100 COMI.EGX at 84.15"*, or *"any alerts crossed?"* — tools speak **EGP**. Available tools: `list_positions`, `get_portfolio_summary`, `list_transactions`, `get_price_history`, `list_watchlist`, `get_triggered_alerts`, `record_transaction`, `delete_transaction`, `set_alert`, `upsert_security`, `refresh_prices`.

### Tests & core demo

```bash
pnpm test                           # 82 tests
pnpm typecheck
pnpm demo                           # terminal demo of the engine (no key/network)
```

## Documentation

- Specs: [core design](docs/superpowers/specs/2026-07-03-egx-portfolio-tracker-design.md) · [ticker page](docs/superpowers/specs/2026-07-03-ticker-page-design.md) · [MCP server](docs/superpowers/specs/2026-07-04-mcp-server-design.md) · [one-app architecture](docs/superpowers/specs/2026-07-09-one-app-architecture-design.md)
- Plans: [core](docs/superpowers/plans/2026-07-03-egx-tracker-core.md) · [web](docs/superpowers/plans/2026-07-03-egx-tracker-web.md) · [ticker page](docs/superpowers/plans/2026-07-03-ticker-page.md) · [MCP server](docs/superpowers/plans/2026-07-04-mcp-server.md) · [one-app architecture](docs/superpowers/plans/2026-07-09-one-app-architecture.md)
- UI: [design brief](docs/design/claude-design-brief.md) · [dashboard mockup](docs/design/mockups/egx-folio.html)

## Disclaimer

Personal-use software. Not financial advice, not affiliated with the Egyptian Exchange or EODHD. Providing trading recommendations to others in Egypt may require FRA (Financial Regulatory Authority) licensing — out of scope for this project.
