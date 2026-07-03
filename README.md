# EGX Portfolio Tracker

A personal, single-user tool to track equity positions on the **Egyptian Exchange (EGX)**, value them against end-of-day prices from [EODHD](https://eodhd.com), and use **Claude Code** as an AI brain for portfolio analysis, news research, and price-alert digests.

> **Not a trading platform.** EGX has no public retail trading API (neither the exchange nor brokers like Thndr, EFG Hermes, or Beltone expose one). This is a **tracker + advisory/analysis** tool — you place orders manually in your broker app. Buy/sell suggestions are for personal use only.

## Status

🚧 **In progress.** Built in three plans:

| Plan | Scope | State |
|------|-------|-------|
| **1. `packages/core`** | SQLite data layer, repositories, portfolio math, alerts, digest, EODHD client | ✅ **Complete** — 48 tests passing |
| **2. `apps/mcp`** | MCP server exposing core as tools for Claude Code | ⏳ Planned |
| **3. `apps/web`** | Next.js dashboard (see the [EGX Folio design mockup](docs/design/mockups/egx-folio.html)) | ⏳ Planned |

## Architecture

TypeScript pnpm-workspace monorepo. All logic lives in `packages/core`; the `apps/*` shells are thin presenters over it.

```
packages/core/     the brain — no UI, no MCP knowledge
  db/              SQLite (better-sqlite3), schema, migrations, WAL
  repositories/    securities, transactions, prices, watchlist
  portfolio/       weighted-avg-cost holdings, valuation, summary
  alerts/          evaluate watchlist vs latest close
  digest/          daily summary (value, alerts, top movers)
  eodhd/           EODHD API client (injected fetch)
  services/        price-sync
apps/web/          (planned) Next.js dashboard
apps/mcp/          (planned) MCP server for Claude Code
docs/              design spec, implementation plans, UI brief + mockup
```

**Key decisions**

- **Transactions are the source of truth**; holdings are derived (weighted-average cost; buy fees add to basis, sell fees reduce realized proceeds).
- **All money is integer piasters** (1 EGP = 100 piasters) — never floating point, to avoid drift.
- **End-of-day prices.** EODHD offers no real-time feed for EGX (~15–20 min delayed at best), so the tool values against the latest close and stamps everything "prices as of `<date>`".
- **Graceful degradation.** A failed price fetch never blocks the app; it falls back to the last stored close.

## Tech stack

Node 20+ · TypeScript 5 · pnpm 9+ · better-sqlite3 · vitest

## Getting started

```bash
pnpm install
pnpm --filter @egx/core test        # run the core test suite
pnpm --filter @egx/core typecheck   # type-check
```

You'll need an [EODHD API key](https://eodhd.com) (paid plan recommended — the free tier is 20 calls/day). Set it in `.env`:

```
EODHD_API_KEY=your_key_here
```

EGX tickers use the `CODE.EGX` format (e.g. `COMI.EGX` for Commercial International Bank).

## Documentation

- [Design spec](docs/superpowers/specs/2026-07-03-egx-portfolio-tracker-design.md)
- [Core implementation plan](docs/superpowers/plans/2026-07-03-egx-tracker-core.md)
- [UI design brief](docs/design/claude-design-brief.md) + [dashboard mockup](docs/design/mockups/egx-folio.html)

## Disclaimer

Personal-use software. Not financial advice, not affiliated with the Egyptian Exchange or EODHD. Providing trading recommendations to others in Egypt may require FRA (Financial Regulatory Authority) licensing — out of scope for this project.
