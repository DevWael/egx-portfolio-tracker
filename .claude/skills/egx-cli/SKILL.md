---
name: egx-cli
description: Use when the task involves this repo's portfolio data from a terminal instead of the web dashboard or MCP — reading positions/prices/alerts, recording buys/sells, setting price alerts, refreshing EODHD prices, or reading/changing app settings via `pnpm egx <command>`.
---

# egx CLI

## Overview

`pnpm egx <command> [--flags] [--json]` drives this repo's portfolio tracker from a
terminal. It dispatches to the same 11 tool definitions the MCP server exposes to
Claude Code (`lib/mcp/tools.ts`) — identical validation, identical EGP↔piaster
conversion, no separate logic to drift out of sync. It opens `data/egx.db` and
`settings.json` directly; no dev/prod server needs to be running.

Run `pnpm egx help` to list all commands with their descriptions at any time —
that output is generated from the same tool registry this skill documents, so it
is always current even if this file drifts.

## Quick reference

All money amounts are in **EGP** (not piasters) on both input and output. Dates are
`YYYY-MM-DD`. Add `--json` to any command for machine-readable output instead of a
table/key-value dump.

| Command | Flags | Returns |
|---|---|---|
| `list-positions` | — | Holdings: ticker, name, sector, qty, avgCost, lastClose, marketValue, unrealizedPnl(+Pct) |
| `summary` | — | Portfolio totals: market value, cost basis, unrealized/realized P&L, position count |
| `transactions` | `[--ticker T]` | Transaction ledger, optionally filtered to one ticker |
| `price-history` | `--ticker T [--from DATE] [--to DATE]` | Daily OHLCV bars; defaults to the last 365 days |
| `watchlist` | — | Alerts with current status (re-evaluated against the latest close first) |
| `alerts-triggered` | — | Only alerts that have crossed their target |
| `record-transaction` | `--ticker T --side buy\|sell --qty N --price N [--fee N] [--traded-at DATE] [--note S]` | `{ok, transaction}` — auto-creates the security (name=ticker) if unknown |
| `delete-transaction` | `--id N` | `{ok}` |
| `set-alert` | `--ticker T --target-price N --direction above\|below [--note S]` | `{ok, alert}` — auto-creates the security if unknown |
| `upsert-security` | `--ticker T --name S [--sector S]` | `{ok}` — omitting `--sector` keeps the existing one |
| `refresh-prices` | `[--tickers T1,T2,...]` | `{ok, stored, tickers}` or `{ok:false, message}` if `EODHD_API_KEY` isn't set — default is all held+watched tickers |
| `settings` | — | Current settings: `theme`, `accentColor`, `defaultPriceHistoryRange`, `dateFormat` |
| `set-settings` | `[--theme dark\|light] [--accent-color #rrggbb] [--default-price-history-range 1W\|1M\|3M\|6M\|1Y\|max] [--date-format en-GB\|iso\|en-US]` | `{ok, settings}` — only passed fields change |
| `help` | — | This command list, generated from the live tool registry |

## Flag syntax

- `--flag value` — space-separated, not `=`. Kebab-case on the CLI maps to the
  tool's camelCase field (`--target-price` → `targetPrice`).
- Array-typed flags (only `refresh-prices --tickers`) are **comma-separated**, no
  spaces: `--tickers COMI.EGX,SWDY.EGX`.
- An unrecognized `--flag` is a hard error (`Unknown flag: --foo`), not silently
  ignored — typos surface immediately instead of producing wrong output.
- Ticker values need the full `.EGX` suffix on the CLI (`COMI.EGX`, not `COMI`) —
  unlike the web form, the CLI does not auto-append it.

## Examples

```bash
pnpm egx list-positions
pnpm egx summary --json
pnpm egx price-history --ticker COMI.EGX --from 2026-01-01
pnpm egx record-transaction --ticker COMI.EGX --side buy --qty 100 --price 84.15
pnpm egx set-alert --ticker SWDY.EGX --target-price 90 --direction above
pnpm egx refresh-prices --tickers COMI.EGX,SWDY.EGX
pnpm egx set-settings --theme light --accent-color "#3b82f6"
```

## Exit codes and errors

- `0` on success, `1` on any failure (bad/missing flags, unknown command, or a
  tool result shaped `{ok: false, ...}` such as `refresh-prices` with no API key).
- Validation errors print one `field: message` line per problem — not a stack
  trace. Same underlying zod schema as the MCP tools, so the same input that's
  invalid for Claude Code is invalid here too.
- `refresh-prices` needs `EODHD_API_KEY` set in the environment; without it, it
  returns `{ok: false, message: "Set EODHD_API_KEY..."}` rather than failing loudly.
  This is a live network call against a metered free-tier API (20 calls/day) —
  don't run it speculatively just to check something else.

## Common mistakes

| Mistake | Fix |
|---|---|
| Typing `COMI` instead of `COMI.EGX` | CLI requires the full suffix; only the web form auto-appends it |
| `--tickers COMI.EGX, SWDY.EGX` (space after comma) | No space — `COMI.EGX,SWDY.EGX` |
| Assuming a running `pnpm dev`/`pnpm start` is required | Not for the CLI — it opens the DB/settings files directly. Only the MCP HTTP endpoint needs the server running |
| Passing `--name`/`--sector` on `record-transaction` | Those aren't in this tool's schema — use `upsert-security` separately if the auto-created name (= ticker) isn't good enough |
| Re-running `refresh-prices` to "double check" | Burns free-tier quota for no reason — read `list-positions`/`price-history` instead, which never call EODHD |
