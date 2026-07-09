# Graph Report - .  (2026-07-09)

## Corpus Check
- 116 files · ~61,134 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 598 nodes · 1241 edges · 38 communities (35 shown, 3 thin omitted)
- Extraction: 97% EXTRACTED · 2% INFERRED · 1% AMBIGUOUS · INFERRED: 26 edges (avg confidence: 0.82)
- Token cost: 345,339 input · 0 output

## Community Hubs (Navigation)
- Core Package Engine (DB, Portfolio, Repos)
- Web App Server Actions & Shell
- Dashboard & Ticker UI Components
- Web App Package Manifest
- Ticker Page Design & Plan
- MCP Package Manifest
- Web App TypeScript Config
- SDD Task Briefs (Mixed/Stale Refs)
- Core Package Manifest
- UI Design Brief & Mockup
- Transactions & Securities CRUD Plan
- SDD Progress: Holdings/Summary Fix
- SDD: Digest & Alert Evaluation
- SDD Progress & Task Reports
- Project Design Spec & Workspace Config
- MCP Server Design & Read Tools
- EODHD Client & Data Controls Plan
- Money & Error-Handling Rationale
- Base TypeScript Config
- Architecture & Isolation Contract
- Watchlist Alert CRUD Plan
- MCP Server Wiring & Registration
- Root Package Manifest
- MCP TypeScript Config
- Alert Evaluation & Digest Plan
- Dashboard Components Plan
- MCP Scaffold SDD Tasks
- Watchlist Page SDD Tasks
- Web Scaffold & Visual Direction
- DB & Types Plan
- Holdings & Valuation Plan
- Prices Repository Plan
- Backup Script
- Core TypeScript Config
- Next.js Config
- Next.js Env Types

## God Nodes (most connected - your core abstractions)
1. `DB` - 26 edges
2. `egp()` - 23 edges
3. `getDb()` - 21 edges
4. `openDb()` - 21 edges
5. `migrate()` - 21 edges
6. `upsertSecurity()` - 21 edges
7. `getPortfolioSummary()` - 18 edges
8. `Task 2 Brief: MCP read tools` - 17 edges
9. `compilerOptions` - 16 edges
10. `addAlert()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `Graceful Degradation (rationale)` --semantically_similar_to--> `Error Handling (EODHD failures, ticker validation, concurrency)`  [INFERRED] [semantically similar]
  README.md → docs/superpowers/specs/2026-07-03-egx-portfolio-tracker-design.md
- `seedDemo()` --indirect_call--> `price()`  [INFERRED]
  apps/web/app/actions.ts → packages/core/test/evaluate.test.ts
- `Registration (claude mcp add)` --conceptually_related_to--> `MCP Server (Claude Code) Section`  [INFERRED]
  docs/superpowers/specs/2026-07-04-mcp-server-design.md → README.md
- `McpTool` --references--> `DB`  [EXTRACTED]
  apps/mcp/src/tools.ts → packages/core/src/db/connection.ts
- `seedDemo()` --calls--> `upsertPrice()`  [EXTRACTED]
  apps/web/app/actions.ts → packages/core/src/repositories/prices.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Realized P&L exclusion: flagged in Task 8, escalated in final review, fixed in Task 12** — superpowers_sdd_task_8_report_realized_pnl_gap, superpowers_sdd_progress_plan_core_package, superpowers_sdd_task_12_report_deriveholdingswithrealized [EXTRACTED 1.00]
- **EODHD failure handling: EodhdError defined, flagged incomplete in final review, hardened in Task 12 Fix B** — superpowers_sdd_task_11_brief_eodhderror, superpowers_sdd_progress_plan_core_package, superpowers_sdd_task_12_report_fix_b_client_hardening [EXTRACTED 1.00]
- **McpTool interface + defineTool factory + createServer registration loop form the MCP tool-registry pipeline** — superpowers_sdd_task_2_brief_mcptool, superpowers_sdd_task_2_brief_definetool, superpowers_sdd_task_4_brief_createserver [INFERRED 0.85]
- **EGP/Piaster Money Boundary Pattern (core stores piasters, edges convert to EGP)** — egx_tracker_core_plan_integer_piasters_constraint, egx_tracker_web_plan_format_egp, mcp_server_plan_topiasters_fn, mcp_server_plan_toegp_fn [INFERRED 0.85]
- **Thin-Shell-Over-Core Architecture (web + mcp both wrap @egx/core with no business logic)** — egx_portfolio_tracker_design_spec_isolation_contract, egx_tracker_web_plan_data_module, mcp_server_plan_tools_array, egx_tracker_core_plan_core_index_export_surface [INFERRED 0.85]
- **Design Brief → Mockup → Web Dashboard Handoff Chain** — docs_design_claude_design_brief_egx_portfolio_tracker_design_brief, docs_design_mockups_egx_folio_html_mockup, egx_tracker_web_plan_task_3_dashboard_page [INFERRED 0.85]

## Communities (38 total, 3 thin omitted)

### Community 0 - "Core Package Engine (DB, Portfolio, Repos)"
Cohesion: 0.06
Nodes (66): DEFAULT_PATH, getDb(), server, toEgp(), toPiasters(), createServer(), isoDate, McpTool (+58 more)

### Community 1 - "Web App Server Actions & Shell"
Cohesion: 0.07
Nodes (39): hashSeed(), makeBackup(), mulberry32(), priceSeries(), refreshPrices(), restoreLatestBackup(), seedDemo(), GET() (+31 more)

### Community 2 - "Dashboard & Ticker UI Components"
Cohesion: 0.11
Nodes (31): DigestPage(), Dashboard(), TickerPage(), AllocationDonut(), HoldingsTable(), RowGroup(), Area(), fmtDate() (+23 more)

### Community 3 - "Web App Package Manifest"
Cohesion: 0.08
Nodes (25): dependencies, better-sqlite3, @egx/core, next, react, react-dom, server-only, devDependencies (+17 more)

### Community 4 - "Ticker Page Design & Plan"
Cohesion: 0.12
Nodes (25): listTransactions(db, ticker?), Tool: list_transactions, Per-Ticker Detail Page — Design Spec, Architecture (PriceChart, ticker.ts, stats.ts), Error handling / edge cases (unknown symbol, no history, not held), Out of scope (future): fundamentals, news, intraday, indicators, Scope: chart, position, transactions, derived stats, Stats Math (returns, volatility, max drawdown, 52w hi/lo, volume) (+17 more)

### Community 5 - "MCP Package Manifest"
Cohesion: 0.10
Nodes (19): bin, egx-mcp, dependencies, @egx/core, @modelcontextprotocol/sdk, zod, devDependencies, tsx (+11 more)

### Community 6 - "Web App TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 7 - "SDD Task Briefs (Mixed/Stale Refs)"
Cohesion: 0.12
Nodes (20): Task 11 Brief: EODHD client (injected fetch), EodhdClient class, EodhdError class, EodhdClient.getEod(ticker, from, to): Promise<PriceBar[]>, Task 11 Report: EODHD client, syncPrices(db, client, tickers, from, to): Promise<number>, EodhdClient hardened to convert network errors/malformed JSON into EodhdError for graceful per-ticker degrade, toPiasters(egp): EGP -> integer piasters (+12 more)

### Community 8 - "Core Package Manifest"
Cohesion: 0.11
Nodes (18): dependencies, better-sqlite3, devDependencies, tsx, @types/better-sqlite3, @types/node, typescript, vitest (+10 more)

### Community 9 - "UI Design Brief & Mockup"
Cohesion: 0.15
Nodes (16): Screen: Add/Edit Transaction, Allocation Donut (design spec), Screen: Daily Digest, EGX Portfolio Tracker Design Brief, Global Shell (nav, header, number styling), Holdings Table (design spec), Out of Scope (do NOT design), Screen: Portfolio Overview (+8 more)

### Community 10 - "Transactions & Securities CRUD Plan"
Cohesion: 0.17
Nodes (16): addTransaction(db, t), deleteTransaction(db, id), getSecurity(db, ticker), listSecurities(db), Task 3: Securities repository, Task 4: Transactions repository, upsertSecurity(db, s), createTransaction server action (+8 more)

### Community 11 - "SDD Progress: Holdings/Summary Fix"
Cohesion: 0.19
Nodes (15): Plan 1: EGX Tracker Core (feat/core-package), Task 12 Brief: Public API surface + price-sync service, packages/core/src/index.ts public API barrel, Task 12 Report: Public API surface + price-sync service, Deleted obsolete smoke.test.ts/CORE_VERSION to match brief's verbatim public index.ts, deriveHoldingsWithRealized(transactions) (Fix A: all-time realized P&L), Task 7 Brief: Portfolio holdings derivation (weighted-average cost), deriveHoldings(transactions): Holding[] (+7 more)

### Community 12 - "SDD: Digest & Alert Evaluation"
Cohesion: 0.15
Nodes (15): Task 10 Brief: Daily digest builder, buildDigest(db): Digest, Digest interface, Task 10 Report: Daily digest builder, Task 2 Brief: MCP read tools, get_portfolio_summary MCP tool, get_price_history MCP tool, get_triggered_alerts MCP tool (+7 more)

### Community 13 - "SDD Progress & Task Reports"
Cohesion: 0.24
Nodes (13): SDD Progress — EGX Tracker (aggregate log), Plan: MCP server (feat/mcp-server), Plan: Ticker page (feat/ticker-page), Plan 3: apps/web (feat/web-app), SDD task-N file paths reused across sequential plans, causing stale/mismatched Task-N cross-references, Task 1 Brief: Scaffold @egx/mcp + shared DB + money helpers, toEgp(piasters): integer piasters -> EGP, Task 1 Report: Scaffold @egx/mcp (+5 more)

### Community 14 - "Project Design Spec & Workspace Config"
Cohesion: 0.17
Nodes (11): EGX Portfolio Tracker — Design Spec, Fetch-on-Access Price Refresh (rationale), Constraints & external reality (EODHD/EGX), Intelligence Is Not a Tool We Build (rationale), Optional launchd Daily Job (deferred), Non-goals (YAGNI), Open Items for Implementation Planning, Purpose: personal single-user EGX tracker (+3 more)

### Community 15 - "MCP Server Design & Read Tools"
Cohesion: 0.18
Nodes (12): MCP Tools (Claude Code interface) spec section, EGX MCP Server — Design Spec, Data flow (Claude Code → stdio → server → tools → core), Error handling / edge cases (missing key, unknown ticker, zod validation), Out of scope (future): HTTP/SSE, resources/prompts, derived-stats tools, Purpose: stdio MCP server, data-only, shared DB, Scope (in/out), Testing (vitest, temp DB, mocked EODHD) (+4 more)

### Community 16 - "EODHD Client & Data Controls Plan"
Cohesion: 0.27
Nodes (12): packages/core/src/index.ts (public export surface), EodhdClient class, EodhdError class, EodhdClient.getEod(ticker, from, to), EodhdClient.search(query), syncPrices(db, client, tickers, from, to), Task 11: EODHD client (injected fetch, mocked in tests), Task 12: Public API surface + price-sync service + integration smoke test (+4 more)

### Community 17 - "Money & Error-Handling Rationale"
Cohesion: 0.18
Nodes (11): Error Handling (EODHD failures, ticker validation, concurrency), Integer Piasters Global Constraint, Bundling Risk / Turbopack Incompatibility (rationale), SCHEMA_SQL constant (schema.ts), Task 1: Inline core's SQL schema (remove runtime file read), End-of-Day Prices Only (rationale), Graceful Degradation (rationale), All Money Is Integer Piasters (rationale) (+3 more)

### Community 18 - "Base TypeScript Config"
Cohesion: 0.18
Nodes (10): compilerOptions, declaration, esModuleInterop, module, moduleResolution, resolveJsonModule, skipLibCheck, strict (+2 more)

### Community 19 - "Architecture & Isolation Contract"
Cohesion: 0.22
Nodes (10): Architecture Choice A — TypeScript monorepo, shared core, Isolation Contract per Unit (core/web/mcp), Architecture (db.ts, tools.ts, server.ts, index.ts), Task 1: Scaffold @egx/mcp + shared DB + money helpers, toPiasters(egp) (apps/mcp/src/money.ts), Architecture Overview (monorepo layout), Disclaimer (personal-use, FRA licensing note), EGX Portfolio Tracker (project) (+2 more)

### Community 20 - "Watchlist Alert CRUD Plan"
Cohesion: 0.28
Nodes (9): addAlert(db, a), deleteAlert(db, id), setAlertActive(db, id, active), Task 6: Watchlist / alerts repository, createAlert server action, removeAlert server action, Task 5: Watchlist page (list + add + toggle + delete), toggleAlert server action (+1 more)

### Community 21 - "MCP Server Wiring & Registration"
Cohesion: 0.31
Nodes (9): Registration (claude mcp add), createServer() (apps/mcp/src/server.ts), apps/mcp/src/index.ts entrypoint, Task 4: Server wiring, entrypoint, boot smoke test, README, toEgp(piasters) (apps/mcp/src/money.ts), Tool: get_portfolio_summary, Tool: list_positions, tools: McpTool[] registry (+1 more)

### Community 22 - "Root Package Manifest"
Cohesion: 0.22
Nodes (8): engines, node, name, private, scripts, test, typecheck, type

### Community 23 - "MCP TypeScript Config"
Cohesion: 0.25
Nodes (7): compilerOptions, module, moduleResolution, noEmit, types, extends, include

### Community 24 - "Alert Evaluation & Digest Plan"
Cohesion: 0.29
Nodes (8): evaluateAlerts(db), getLatestPrice(db, ticker), listAlerts(db, activeOnly?), markTriggered(db, id, when), Task 10: Daily digest builder, Task 9: Alert evaluation, Tool: get_triggered_alerts, Tool: list_watchlist

### Community 25 - "Dashboard Components Plan"
Cohesion: 0.29
Nodes (7): buildDigest(db), Digest interface, data module (apps/web/lib/data.ts), DigestCard component, HoldingsTable component (initial), SummaryBand component, Task 3: Dashboard page

### Community 26 - "MCP Scaffold SDD Tasks"
Cohesion: 0.29
Nodes (7): getDb(): shared cached DB connection, MCP server and web app share one SQLite file; WAL-safe concurrent access needed, tools: McpTool[] registry array, Task 4 Brief: MCP server wiring, entrypoint, boot test, README, createServer(): McpServer, apps/mcp/src/index.ts stdio entrypoint, README "MCP server (Claude Code)" section

### Community 27 - "Watchlist Page SDD Tasks"
Cohesion: 0.29
Nodes (7): Task 5 Brief: Watchlist page (web), createAlert() server action, removeAlert() server action, toggleAlert() server action, WatchlistPage component (/watchlist route), Task 9 Brief: Alert evaluation, Task 9 Report: Alert evaluation

### Community 28 - "Web Scaffold & Visual Direction"
Cohesion: 0.33
Nodes (6): Handoff to Claude Code, Visual Direction (clean fintech, trustworthy, quiet), Dark-Green Fintech Visual Theme, egp(piasters) formatter, pct(x) formatter, Task 2: Scaffold apps/web — Next.js shell, DB singleton, data layer, theme

### Community 29 - "DB & Types Plan"
Cohesion: 0.47
Nodes (6): Data Model (SQLite tables), migrate(db), openDb(path), Task 2: Types + database connection + schema migration, getDb() (apps/web/lib/db.ts), getDb() (apps/mcp/src/db.ts)

### Community 30 - "Holdings & Valuation Plan"
Cohesion: 0.40
Nodes (6): deriveHoldings(transactions), getPortfolioSummary(db), Task 7: Portfolio holdings derivation (weighted-avg cost), Task 8: Portfolio valuation + summary, valueHoldings(db, holdings), Weighted-Average Cost Method (rationale)

### Community 31 - "Prices Repository Plan"
Cohesion: 0.33
Nodes (6): getLatestPriceDate(db), getPriceHistory(db, ticker, from, to), Task 5: Prices repository, upsertPrice(db, bar), upsertPrices(db, bars), Tool: get_price_history

### Community 32 - "Backup Script"
Cohesion: 0.40
Nodes (4): db, dest, dir, ts

## Ambiguous Edges - Review These
- `Task 10 Brief: Daily digest builder` → `Task 2 Brief: MCP read tools`  [AMBIGUOUS]
  .superpowers/sdd/task-10-brief.md · relation: references
- `Task 11 Brief: EODHD client (injected fetch)` → `Task 2 Brief: MCP read tools`  [AMBIGUOUS]
  .superpowers/sdd/task-11-brief.md · relation: references
- `Task 2 Brief: MCP read tools` → `Task 7 Brief: Portfolio holdings derivation (weighted-average cost)`  [AMBIGUOUS]
  .superpowers/sdd/task-7-brief.md · relation: references
- `Task 2 Brief: MCP read tools` → `Task 8 Brief: Portfolio valuation + summary`  [AMBIGUOUS]
  .superpowers/sdd/task-8-brief.md · relation: references
- `Task 2 Brief: MCP read tools` → `Task 9 Brief: Alert evaluation`  [AMBIGUOUS]
  .superpowers/sdd/task-9-brief.md · relation: references
- `Task 4 Brief: MCP server wiring, entrypoint, boot test, README` → `Task 8 Brief: Portfolio valuation + summary`  [AMBIGUOUS]
  .superpowers/sdd/task-8-brief.md · relation: references
- `Task 5 Brief: Watchlist page (web)` → `Task 8 Brief: Portfolio valuation + summary`  [AMBIGUOUS]
  .superpowers/sdd/task-8-brief.md · relation: references
- `Task 5 Brief: Watchlist page (web)` → `Task 9 Brief: Alert evaluation`  [AMBIGUOUS]
  .superpowers/sdd/task-9-brief.md · relation: references
- `Task 6 Brief: Data controls — seed demo + refresh prices` → `Task 9 Brief: Alert evaluation`  [AMBIGUOUS]
  .superpowers/sdd/task-9-brief.md · relation: references

## Knowledge Gaps
- **165 isolated node(s):** `name`, `version`, `private`, `type`, `egx-mcp` (+160 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Task 10 Brief: Daily digest builder` and `Task 2 Brief: MCP read tools`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Task 11 Brief: EODHD client (injected fetch)` and `Task 2 Brief: MCP read tools`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Task 2 Brief: MCP read tools` and `Task 7 Brief: Portfolio holdings derivation (weighted-average cost)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Task 2 Brief: MCP read tools` and `Task 8 Brief: Portfolio valuation + summary`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Task 2 Brief: MCP read tools` and `Task 9 Brief: Alert evaluation`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Task 4 Brief: MCP server wiring, entrypoint, boot test, README` and `Task 8 Brief: Portfolio valuation + summary`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Task 5 Brief: Watchlist page (web)` and `Task 8 Brief: Portfolio valuation + summary`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._