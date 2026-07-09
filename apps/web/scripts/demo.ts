/**
 * Runnable demo of lib/core — no API key or network needed.
 *
 * Seeds an in-memory portfolio, "fetches" end-of-day prices via a stubbed
 * EODHD client (offline), then prints the portfolio summary, triggered
 * alerts, and daily digest exactly as the real engine computes them.
 *
 * Run:  pnpm --filter lib/core demo
 */
import {
  openDb,
  migrate,
  upsertSecurity,
  addTransaction,
  addAlert,
  listAlerts,
  EodhdClient,
  syncPrices,
  getPortfolioSummary,
  buildDigest,
} from "../lib/core/index.js";

// ---- display helpers (piasters -> EGP; fraction -> %) ----
const egp = (piasters: number | null): string =>
  piasters === null
    ? "—"
    : "EGP " +
      (piasters / 100).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
const pct = (x: number | null): string =>
  x === null ? "—" : (x * 100).toFixed(2) + "%";
const R = (s: string, n: number) => s.padStart(n);
const L = (s: string, n: number) => s.padEnd(n);

// ---- offline EODHD stub: canned latest close (EGP) per ticker ----
const CLOSES: Record<string, number> = {
  "COMI.EGX": 84.15,
  "HRHO.EGX": 22.6,
  "SWDY.EGX": 78.3,
  "FWRY.EGX": 6.85,
};
const fakeFetch = (async (url: string) => {
  const m = String(url).match(/\/eod\/([^?]+)/);
  const ticker = m ? decodeURIComponent(m[1]) : "";
  const close = CLOSES[ticker];
  const body =
    close === undefined
      ? []
      : [
          {
            date: "2026-07-02",
            open: close,
            high: close,
            low: close,
            close,
            volume: 1_000_000,
          },
        ];
  return new Response(JSON.stringify(body), { status: 200 });
}) as unknown as typeof fetch;

async function main() {
  const db = openDb(":memory:");
  migrate(db);

  // Securities
  const securities: [string, string, string][] = [
    ["COMI.EGX", "Commercial International Bank", "Banks"],
    ["HRHO.EGX", "EFG Holding", "Financials"],
    ["SWDY.EGX", "Elsewedy Electric", "Industrials"],
    ["FWRY.EGX", "Fawry", "Fintech"],
    ["EAST.EGX", "Eastern Company", "Consumer"],
  ];
  for (const [ticker, name, sector] of securities) {
    upsertSecurity(db, { ticker, name, sector, currency: "EGP" });
  }

  // Transactions (price in piasters: 1 EGP = 100)
  addTransaction(db, { ticker: "COMI.EGX", side: "buy", qty: 500, price: 7240, tradedAt: "2026-06-01" });
  addTransaction(db, { ticker: "HRHO.EGX", side: "buy", qty: 1200, price: 1890, tradedAt: "2026-06-02" });
  addTransaction(db, { ticker: "SWDY.EGX", side: "buy", qty: 600, price: 6100, tradedAt: "2026-06-03" });
  addTransaction(db, { ticker: "FWRY.EGX", side: "buy", qty: 2000, price: 510, tradedAt: "2026-06-04" });
  // A fully-closed round-trip: bought 300 @ 52.00, sold 300 @ 58.00 -> EGP 1,800 realized.
  // It won't appear in holdings (qty 0) but DOES count in Realized P&L.
  addTransaction(db, { ticker: "EAST.EGX", side: "buy", qty: 300, price: 5200, tradedAt: "2026-06-05" });
  addTransaction(db, { ticker: "EAST.EGX", side: "sell", qty: 300, price: 5800, tradedAt: "2026-06-20" });

  // Watchlist alerts
  addAlert(db, { ticker: "COMI.EGX", targetPrice: 8000, direction: "above", note: "take-profit watch" });
  addAlert(db, { ticker: "FWRY.EGX", targetPrice: 700, direction: "above" });
  addAlert(db, { ticker: "SWDY.EGX", targetPrice: 5000, direction: "below" });

  // Fetch EOD prices — offline stub instead of the live EODHD API.
  const client = new EodhdClient({ apiKey: "demo-no-network", fetchImpl: fakeFetch });
  const held = ["COMI.EGX", "HRHO.EGX", "SWDY.EGX", "FWRY.EGX"];
  const stored = await syncPrices(db, client, held, "2026-07-01", "2026-07-02");

  // ---- Report ----
  const s = getPortfolioSummary(db);
  console.log("\n=== EGX Portfolio Tracker — demo ===");
  console.log(`(offline: prices stubbed via EODHD client, ${stored} bars stored; prices as of ${s.asOf})\n`);

  console.log(
    L("Ticker", 10) + L("Qty", 7) + R("Avg cost", 15) + R("Last", 13) +
    R("Mkt value", 17) + R("Unrealized", 16) + R("P&L %", 10)
  );
  console.log("-".repeat(88));
  for (const h of s.holdings) {
    console.log(
      L(h.ticker, 10) +
      L(String(h.qty), 7) +
      R(egp(h.avgCost), 15) +
      R(egp(h.lastClose), 13) +
      R(egp(h.marketValue), 17) +
      R(egp(h.unrealizedPnl), 16) +
      R(pct(h.unrealizedPnlPct), 10)
    );
  }
  console.log("-".repeat(88));
  console.log(`Total market value : ${egp(s.totalMarketValue)}`);
  console.log(`Total cost basis   : ${egp(s.totalCostBasis)}`);
  console.log(`Unrealized P&L     : ${egp(s.totalUnrealizedPnl)}  (${pct(s.totalUnrealizedPnlPct)})`);
  console.log(`Realized P&L       : ${egp(s.totalRealizedPnl)}  (incl. closed EAST.EGX round-trip)`);

  // Daily digest (this also evaluates + stamps alerts)
  const d = buildDigest(db);

  console.log(`\nTriggered alerts (${d.triggered.length}):`);
  for (const t of d.triggered) {
    console.log(`  • ${t.alert.ticker} ${t.alert.direction} ${egp(t.alert.targetPrice)} — crossed at ${egp(t.lastClose)} (${t.lastCloseDate})`);
  }

  console.log(`\nWatchlist:`);
  for (const a of listAlerts(db)) {
    console.log(`  • ${L(a.ticker, 10)} ${L(a.direction, 6)} ${R(egp(a.targetPrice), 14)}  — ${a.triggeredAt ? "CROSSED " + a.triggeredAt : "watching"}`);
  }

  console.log(`\nTop movers:`);
  for (const m of d.topMovers) {
    console.log(`  • ${L(m.ticker, 10)} ${R(pct(m.unrealizedPnlPct), 8)}  (${egp(m.unrealizedPnl)})`);
  }
  console.log();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
