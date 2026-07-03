# EGX Portfolio Tracker — Design Brief (for Claude Design)

Paste or upload this whole file into Claude Design. Pick the **Prototype**
template (interactive) — or **Wireframe** if you want structure first. Desktop
web, dark + light themes.

---

## 1. What this is

A personal, single-user portfolio tracker for the **Egyptian Exchange (EGX)**.
It tracks stock positions, shows profit/loss against the latest market close,
and surfaces price alerts and a daily digest. It is **not** a trading terminal —
no order buttons, no live tick streaming. Tone: calm, long-term investor, not
day-trader adrenaline.

- **User:** one person (the owner), on their own laptop.
- **Currency:** Egyptian Pound. Format as `EGP 1,234.56` with thousands
  separators and 2 decimals, tabular-lining figures so columns align.
- **Data freshness:** prices are end-of-day. Every screen shows a
  **"Prices as of &lt;date&gt;"** stamp. Never imply real-time.

## 2. Global shell

- **Left nav** (or top tabs): Portfolio · Transactions · Watchlist · Digest.
- **Header:** app name, a "Prices as of DD Mon YYYY" chip, a manual **Refresh
  prices** button, and a **light/dark** toggle. Small account avatar (single
  user — no login screen needed).
- **Number styling:** gains **green**, losses **red**, neutral in default text
  color. Always show both absolute EGP and % where relevant. Use tabular
  figures throughout tables.
- **Empty / loading / error states** are first-class (see §7).

## 3. Screen — Portfolio Overview (default / home)

The core screen. Dense but readable.

**Summary band (top):**
- Total market value (EGP)
- Total unrealized P&L (EGP + %) — green/red
- Total invested / cost basis
- Day change (EGP + %) since previous close
- "Prices as of &lt;date&gt;" stamp

**Holdings table** (sortable columns):

| Ticker | Name | Qty | Avg cost | Last close | Mkt value | Unrealized P&L | P&L % | Day chg % |
|--------|------|----:|---------:|-----------:|----------:|---------------:|------:|----------:|

Row interactions: click a row → side panel or expand showing that holding's
mini price chart (line, last ~90 days) and its transaction history.

**Right rail / lower section:**
- **Allocation donut** — by sector (Banks, Financials, Real Estate,
  Industrials, Consumer, Fintech). Legend with % weights.
- **Top movers** — 2–3 biggest up / down since last close.

**Sample data to render (use these real EGX tickers for realism):**

| Ticker | Name | Sector | Qty | Avg cost | Last close |
|--------|------|--------|----:|---------:|-----------:|
| COMI.EGX | Commercial International Bank | Banks | 500 | 72.40 | 84.15 |
| HRHO.EGX | EFG Holding | Financials | 1,200 | 18.90 | 22.60 |
| TMGH.EGX | Talaat Moustafa Group | Real Estate | 800 | 44.10 | 41.75 |
| SWDY.EGX | Elsewedy Electric | Industrials | 600 | 61.00 | 78.30 |
| ABUK.EGX | Abu Qir Fertilizers | Industrials | 300 | 55.20 | 52.90 |
| FWRY.EGX | Fawry | Fintech | 2,000 | 5.10 | 6.85 |

(P&L: COMI, HRHO, SWDY, FWRY green; TMGH, ABUK red. Good mix for the design.)

## 4. Screen — Add / Edit Transaction

A form (modal or dedicated page). Transactions are the source of truth — the
portfolio is derived from them.

Fields:
- **Ticker** — searchable select (type "COMI", pick `COMI.EGX — Commercial
  International Bank`).
- **Side** — Buy / Sell toggle.
- **Quantity** — integer.
- **Price** — EGP, 2 decimals.
- **Fee / commission** — EGP, optional.
- **Trade date** — date picker (defaults today).
- **Note** — optional text.

Below the form: a running list of recent transactions with edit/delete.
Show a small computed preview ("This buy adds 500 @ EGP 72.40 = EGP 36,200 +
fee").

## 5. Screen — Watchlist & Alerts

- Add a ticker + **target price** + direction (**above** / **below**) + note.
- List of active alerts with current last close vs target, and a clear
  **"crossed"** state (badge) when the last close breached the target.
- Toggle alerts active/inactive; delete.

Sample: `COMI.EGX target above EGP 90.00 — not yet (last 84.15)`,
`FWRY.EGX target above EGP 6.50 — ✅ crossed (last 6.85)`.

## 6. Screen — Daily Digest

A single readable card generated after each market close:
- Date + "Prices as of" stamp.
- Portfolio total value + day change.
- Alerts triggered today (list).
- Top movers.
- A slot for an AI note (this is filled by Claude Code later — in the design,
  show it as a quoted "Analysis" block with placeholder commentary).

## 7. States to design (don't skip)

- **Empty portfolio** — no holdings yet → friendly prompt to add first
  transaction.
- **Loading** — skeleton rows in tables, not spinners over whole page.
- **Stale prices** — a subtle amber banner: "Showing last stored close (DD Mon)
  — couldn't reach price source." Data still visible.
- **Price source error** — inline, non-blocking; dashboard never goes blank.
- **Single holding / few holdings** — layout still looks intentional, not empty.

## 8. Visual direction

- **Feel:** clean fintech, trustworthy, quiet. Think a well-designed banking /
  brokerage statement, not a neon crypto app.
- **Density:** numeric tables are the hero — comfortable row height, clear
  column alignment, tabular figures.
- **Color:** neutral base (works in dark + light). Semantic green = gain, red =
  loss, amber = warning/stale. One restrained brand accent for primary actions.
- **Typography:** readable numerics; a slightly editorial heading is fine, body
  and tables strictly legible.
- **Charts:** minimal — a donut for allocation, thin line for price history. No
  heavy gridlines. Match the theme (dark/light).
- **Accessibility:** don't encode gain/loss by color alone — pair with
  +/- sign and arrow. Sufficient contrast in both themes.

## 9. Out of scope (do NOT design)

- Buy/sell **execution** buttons or broker connection (none exists for EGX).
- Real-time tick streaming, order book, depth chart.
- Login / signup / multi-user / team screens.
- Billing, settings sprawl. Keep it tight.

## 10. Handoff

Once the look is approved, export via the code button (`</>`) / hand off to
Claude Code. The visuals will implement the `apps/web` (Next.js) shell of the
tracker; all logic (positions, P&L, prices, alerts) lives in the separate
`core` package per the architecture spec.
