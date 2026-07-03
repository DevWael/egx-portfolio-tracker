# EGX MCP Server — Design

**Date:** 2026-07-04
**Status:** Approved (design)
**Package:** `apps/mcp` (`@egx/mcp`)

## Purpose

A stdio MCP server that lets **Claude Code** manage and analyze the EGX portfolio by calling tools over `@egx/core` — reading positions/prices/alerts and writing transactions/alerts/prices. It shares the same SQLite database as the web app, so chat and dashboard are one dataset. The server is data-only; the intelligence (news research, buy/sell reasoning) is Claude Code itself.

## Scope

- **In:** stdio MCP server; read tools (positions, summary, transactions, price history, watchlist, triggered alerts); write tools (record/delete transaction, set alert, refresh prices, upsert security); EGP↔piaster conversion at the tool boundary; shared DB with the web app; unit-tested tool handlers; a README registration section.
- **Out (deferred):** HTTP/SSE transport, auth, resources/prompts (tools only), derived stats (returns/volatility) as tools, news/fundamentals.

## Architecture

- **`apps/mcp/src/db.ts`** — opens the shared SQLite file (`process.env.EGX_DB_PATH` ?? `<repo>/apps/web/data/egx.db`) via core's `openDb` + `migrate` (idempotent). Cached module-level singleton.
- **`apps/mcp/src/tools.ts`** — the tool registry: for each tool, a name, description, a **zod** input schema (money fields in EGP), and a handler `(db: DB, args) => result`. Handlers wrap `@egx/core`, converting EGP→piasters on input and piasters→EGP on output. No MCP/transport knowledge → unit-testable against a temp DB.
- **`apps/mcp/src/server.ts`** — creates the `McpServer` (`@modelcontextprotocol/sdk`), registers each tool from `tools.ts`, connects a `StdioServerTransport`.
- **`apps/mcp/src/index.ts`** — entrypoint: `server.ts` → connect stdio.

Money: `@egx/core` stores integer **piasters**. Tools speak **EGP** (JS numbers, e.g. `84.15`). Conversion is centralized: `toPiasters(egp) = Math.round(egp * 100)`, `toEgp(piasters) = piasters / 100`. Dates are `'YYYY-MM-DD'`; tickers `CODE.EGX`.

## Tools

Money in/out is **EGP**. Read tools return plain JSON (numbers in EGP, percentages as decimals).

**Read**
- `list_positions` → holdings: ticker, name?, sector?, qty, avgCost, lastClose, marketValue, unrealizedPnl, unrealizedPnlPct, asOf.
- `get_portfolio_summary` → totalMarketValue, totalCostBasis, totalUnrealizedPnl (+pct), totalRealizedPnl, positions, asOf.
- `list_transactions` `{ ticker? }` → id, ticker, side, qty, price, fee, tradedAt, note.
- `get_price_history` `{ ticker, from?, to? }` → bars: date, open, high, low, close (EGP), volume. Defaults: last ~365 days.
- `list_watchlist` → alerts with status (evaluates alerts first so `triggered` is current): id, ticker, targetPrice, direction, active, note, triggeredAt.
- `get_triggered_alerts` → alerts crossed at the latest close.

**Write**
- `record_transaction` `{ ticker, side: "buy"|"sell", qty, price, fee?, tradedAt?, note? }` → upserts the security (name defaults to ticker) then records the transaction. Returns the created row + a refreshed one-line position summary for that ticker.
- `delete_transaction` `{ id }` → deletes; returns ok.
- `set_alert` `{ ticker, targetPrice, direction: "above"|"below", note? }` → upserts security, adds alert.
- `refresh_prices` `{ tickers? }` → fetches EOD from EODHD for the given tickers (default: all held + watched) over the last ~365 days; requires `EODHD_API_KEY` (else returns a message). Returns count stored.
- `upsert_security` `{ ticker, name, sector? }`.

Each tool returns a JSON text content block. Errors return an MCP tool error with a plain message (never throw raw).

## Data flow

Claude Code → stdio → `server.ts` (routes tool call) → `tools.ts` handler → `getDb()` + `@egx/core`. Writes go straight to the shared DB; the web app (`force-dynamic`) reflects them on its next render. `refresh_prices` uses `@egx/core`'s `EodhdClient` + `syncPrices` (graceful per-ticker degradation).

## Registration

Run with `tsx` (no build; core is TS source):
```
claude mcp add egx -- pnpm -C /absolute/path/to/EGX --filter @egx/mcp start
```
where `apps/mcp` has `"start": "tsx src/index.ts"`. `EGX_DB_PATH` and `EODHD_API_KEY` are read from the environment (Claude Code passes the launching env). README gets an "MCP (Claude Code)" section.

## Error handling / edge cases

- **Missing EODHD key:** `refresh_prices` returns `{ ok: false, message: "Set EODHD_API_KEY…" }` — no throw.
- **Unknown ticker in reads:** empty arrays / nulls, not errors.
- **Invalid tool args:** zod validation → a tool error with the validation message.
- **DB is shared:** better-sqlite3 WAL handles concurrent web + MCP access; writes are short transactions.
- **Money:** only EGP crosses the boundary; piasters never leak to Claude.

## Testing

- **`tools.ts` handlers** (vitest, temp `:memory:`/file DB, EODHD mocked via injected fetch):
  - `record_transaction` in EGP → stored piasters correct → `get_portfolio_summary` reflects it;
  - EGP↔piaster round-trip (e.g. `84.15` → `8415` → `84.15`);
  - `set_alert` + `list_watchlist` shows it; a crossed alert appears in `get_triggered_alerts`;
  - `refresh_prices` with a mocked client stores bars; missing key returns the message (no throw);
  - `delete_transaction` removes it.
- **server.ts / stdio:** smoke — the server starts and lists tools (a lightweight boot test), no deep protocol assertions.

## Out of scope (future)

HTTP/SSE transport, MCP resources/prompts, derived-stats tools, news/fundamentals, auth.
