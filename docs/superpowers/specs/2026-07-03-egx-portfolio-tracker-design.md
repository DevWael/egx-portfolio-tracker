# EGX Portfolio Tracker — Design

**Date:** 2026-07-03
**Status:** Approved (design), pre-implementation
**Author:** Ahmad Wael

## 1. Purpose

A personal, single-user, local tool to track equity positions on the Egyptian
Exchange (EGX), fetch end-of-day prices from EODHD, and use Claude Code as the
AI brain for portfolio analysis, news research, buy/sell reasoning, and
price-alert digests.

The app does **not** execute trades. EGX offers no public retail trading API
(neither the exchange nor brokers such as Thndr, EFG Hermes, Beltone, CI Capital
expose one; only institutional FIX via direct broker contracts exists). This
tool is therefore a **tracker + advisory/analysis surface**, not an execution
platform. Orders are placed manually by the user in their broker app.

### Success criteria

- I can record buys/sells and see correct holdings, cost basis, and P&L.
- I see EGX prices as of the latest market close, with a clear "as of" date.
- From Claude Code I can ask "how's my portfolio?", "research news on my
  holdings", "any buy/sell ideas?", and it answers using live data from this app
  plus its own web research.
- I can set price targets and see which were crossed at the last close.

## 2. Non-goals (YAGNI)

- No trade execution, no broker integration.
- No real-time / intraday streaming (EODHD does not offer real-time for EGX;
  ~15–20 min delayed at best, EOD is the chosen cadence).
- No multi-user, no accounts, no auth (localhost, single machine).
- No hosted deployment; runs on the user's Mac.
- No always-on background poller (fetch-on-access covers freshness).

## 3. Constraints & external reality

- **EODHD + EGX:** EOD historical OHLCV and intraday *history* (1-min/5-min bars)
  are covered. True real-time WebSocket is US/Forex/crypto only — **not EGX**.
  Freshest EGX quote available is ~15–20 min delayed; we use **EOD close**.
- **EODHD plans:** free = 20 calls/day (insufficient for regular use). Real use
  needs a paid plan (~€20/mo). Ticker format is `CODE.EGX` (e.g. `COMI.EGX`);
  exact symbols confirmed via the EODHD `search` endpoint during build.
- **Regulatory:** buy/sell suggestions are for **personal use only**. Turning
  this into a product that gives recommendations to others would likely require
  FRA (Financial Regulatory Authority) licensing. Out of scope.

## 4. Architecture (Choice A — TypeScript monorepo, shared core)

```
egx-portfolio-tracker/
  packages/core/     the brain — no UI, no MCP knowledge
    db/              SQLite (better-sqlite3), schema, migrations, WAL
    repositories/    securities, transactions, prices, watchlist
    eodhd/           HTTP client: getEOD(ticker, from, to), search(ticker)
    portfolio/       derive holdings from transactions, P&L, exposure
    alerts/          evaluate watchlist vs latest close -> triggered[]
    digest/          build daily summary
    types/
  apps/web/          Next.js dashboard — thin shell over core
  apps/mcp/          MCP stdio server for Claude Code — thin shell over core
```

Rationale: all logic lives in `core` and is unit-testable without UI or MCP.
`web` and `mcp` are thin presenters over the same tested core reading one
SQLite file. One language (TypeScript). pnpm workspaces.

### Isolation contract per unit

- **core** — pure logic + data access. Depends on: SQLite file, EODHD API.
  Consumers use it via typed functions; internals (SQL, math) can change freely.
- **web** — renders core outputs, collects user input, calls core. No business
  logic of its own.
- **mcp** — maps MCP tool calls to core functions. No business logic of its own.

## 5. Data model (SQLite)

```
securities        ticker PK (e.g. COMI.EGX), name, sector, currency DEFAULT 'EGP'
transactions      id PK, ticker FK, side ('buy'|'sell'), qty, price, fee,
                  traded_at, note
prices            (ticker, date) PK, open, high, low, close, volume, source
watchlist_alerts  id PK, ticker FK, target_price, direction ('above'|'below'),
                  active, note, created_at, triggered_at
settings          key PK, value          (e.g. last_eod_fetch)
```

- **Transactions are the source of truth.** Holdings are *derived*:
  `qty = Σbuys − Σsells`, cost basis = weighted average of buy lots. Enables
  correct P&L across multiple buys and a realized/unrealized split.
- **Money as integer minor units (piasters)** or a decimal type — never raw
  float. Avoids accumulation drift in P&L math.

## 6. MCP tools (Claude Code interface)

**Read**
- `list_positions()` → holdings + cost basis + latest close + unrealized P&L
- `get_portfolio_summary()` → totals, exposure, concentration, top movers
- `get_price_history(ticker, from, to)` → OHLCV bars (for signals/technicals)
- `list_watchlist()` → alerts + status
- `get_triggered_alerts()` → targets crossed at last close
- `get_securities()` → tickers held/watched (feeds CC's own news research)

**Write**
- `record_transaction(ticker, side, qty, price, fee?, traded_at?, note?)`
- `upsert_security(ticker, name, sector?)`
- `set_alert(ticker, target_price, direction, note?)`
- `refresh_prices(tickers?)` → pull latest EOD from EODHD, store

**Intelligence is not a tool we build.** News research and buy/sell reasoning
are performed by Claude Code natively: it calls `get_securities` → runs its own
WebSearch for news → calls `get_price_history` → reasons → suggests. The app
supplies data; Claude Code supplies intelligence. This delivers all four desired
AI jobs (P&L analysis, news research, buy/sell suggestions, alerts) without
building an in-app LLM layer.

## 7. Data flow

### Daily EOD prices (chosen cadence)

- **Primary — fetch-on-access:** when the dashboard loads or any MCP tool runs,
  if today's close for held/watched tickers is not yet stored *and* the market
  has closed, fetch from EODHD and store. Guarantees fresh data whenever the
  user actually looks; needs no always-on process (solves laptop-sleep).
- **Optional — launchd job (~15:30 EET):** runs a `refresh` script hands-off →
  fetch EOD, store, build digest, evaluate alerts. Bonus for a ready morning
  digest; if the Mac was asleep, fetch-on-access covers it on next open.

### On-demand (Claude Code)

User chats → CC calls `get_portfolio_summary` (triggers refresh-if-stale) →
returns data → CC pulls news via WebSearch → reasons → replies. Same path powers
analysis and signal suggestions.

## 8. Error handling

- **EODHD failures** (rate limit, 402 plan, market holiday = no new bar, unknown
  ticker): cache one fetch per ticker per day; on failure **degrade to last
  stored close** and stamp all outputs "prices as of `<date>`". Never block the
  dashboard on an API error — show stale data + a visible warning.
- **Ticker validation:** confirm `.EGX` symbol via EODHD `search` on add; reject
  unknown tickers.
- **Concurrency:** web and MCP both write one SQLite file → WAL mode + short
  transactions. Single user = low contention; better-sqlite3 is synchronous.
- **Secrets:** `EODHD_API_KEY` in `.env` (gitignored), local only.
- **No dashboard auth** — explicit, conscious assumption: localhost, single
  user, personal machine.

## 9. Testing (TDD)

- **Core is the primary test target:** unit tests for portfolio math (holdings
  derivation, weighted avg cost, realized/unrealized P&L), alert evaluation, and
  the EODHD client (mocked HTTP).
- **Repositories:** integration tests against a temp SQLite file.
- **web / mcp:** thin shells → light smoke tests only.

## 10. Open items for implementation planning

- Confirm exact EGX ticker symbols and EODHD `.EGX` suffix behavior via `search`.
- Choose money representation (integer piasters vs decimal library) — decide in
  plan, apply consistently in `core`.
- Pick charting lib for the allocation view (defer; not on critical path).
- Decide whether the optional launchd digest ships in v1 or later.
