"use server";
import { revalidatePath } from "next/cache";
import {
  upsertSecurity, addTransaction, addAlert, upsertPrice,
  listTransactions, listAlerts,
  EodhdClient, syncPrices,
} from "@egx/core";
import { getDb } from "@/lib/db";

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** ~90 daily closes (piasters) ending 2026-07-02=last, 2026-07-01=prev, walked back deterministically. */
function priceSeries(ticker: string, prev: number, last: number): { date: string; close: number }[] {
  const N = 90;
  const closes = new Array<number>(N);
  closes[N - 1] = last;
  closes[N - 2] = prev;
  const rng = mulberry32(hashSeed(ticker));
  for (let i = N - 3; i >= 0; i--) {
    const step = (rng() - 0.5) * 0.035; // ±1.75% daily walk, going backward
    closes[i] = Math.max(1, Math.round(closes[i + 1] * (1 - step)));
  }
  const end = new Date("2026-07-02T00:00:00Z");
  return closes.map((close, i) => {
    const d = new Date(end);
    d.setUTCDate(end.getUTCDate() - (N - 1 - i));
    return { date: d.toISOString().slice(0, 10), close };
  });
}

export async function seedDemo() {
  const db = getDb();
  // reset to a clean demo (idempotent — clicking again won't duplicate positions)
  db.exec("DELETE FROM transactions; DELETE FROM prices; DELETE FROM watchlist_alerts; DELETE FROM securities;");
  const secs: [string, string, string][] = [
    ["COMI.EGX", "Commercial International Bank", "Banks"],
    ["HRHO.EGX", "EFG Holding", "Financials"],
    ["SWDY.EGX", "Elsewedy Electric", "Industrials"],
    ["ABUK.EGX", "Abu Qir Fertilizers", "Industrials"],
    ["TMGH.EGX", "Talaat Moustafa Group", "Real Estate"],
    ["FWRY.EGX", "Fawry", "Fintech"],
    ["EAST.EGX", "Eastern Company", "Consumer"],
  ];
  for (const [ticker, name, sector] of secs) upsertSecurity(db, { ticker, name, sector, currency: "EGP" });

  // Several lots per position (real transaction history), plus one closed
  // round-trip that produces realized P&L. Avg costs match the earlier demo.
  const txns: [string, "buy" | "sell", number, number, string][] = [
    ["COMI.EGX", "buy", 300, 7000, "2025-11-10"],
    ["COMI.EGX", "buy", 200, 7600, "2026-02-01"],
    ["HRHO.EGX", "buy", 1200, 1890, "2026-03-15"],
    ["SWDY.EGX", "buy", 400, 5800, "2024-02-01"],
    ["SWDY.EGX", "buy", 200, 6700, "2025-01-15"],
    ["ABUK.EGX", "buy", 300, 5520, "2025-09-20"],
    ["TMGH.EGX", "buy", 800, 4410, "2025-12-05"],
    ["FWRY.EGX", "buy", 2000, 510, "2025-06-01"],
    ["EAST.EGX", "buy", 300, 5200, "2025-10-01"],
    ["EAST.EGX", "sell", 300, 5800, "2026-05-15"],
  ];
  for (const [ticker, side, qty, price, tradedAt] of txns) addTransaction(db, { ticker, side, qty, price, tradedAt });

  // ~90 days of daily closes per held ticker: [ticker, prevClose, lastClose] in piasters
  const priceInputs: [string, number, number][] = [
    ["COMI.EGX", 8350, 8415],
    ["HRHO.EGX", 2215, 2260],
    ["SWDY.EGX", 7700, 7830],
    ["ABUK.EGX", 5360, 5290],
    ["TMGH.EGX", 4230, 4175],
    ["FWRY.EGX", 672, 685],
  ];
  for (const [ticker, prev, last] of priceInputs) {
    for (const bar of priceSeries(ticker, prev, last)) {
      upsertPrice(db, { ticker, date: bar.date, open: bar.close, high: bar.close, low: bar.close, close: bar.close, volume: 1_000_000, source: "demo" });
    }
  }

  const alerts: { ticker: string; targetPrice: number; direction: "above" | "below"; note: string | null }[] = [
    { ticker: "COMI.EGX", targetPrice: 8000, direction: "above", note: "take-profit" },
    { ticker: "FWRY.EGX", targetPrice: 700, direction: "above", note: "add above" },
    { ticker: "SWDY.EGX", targetPrice: 5000, direction: "below", note: "stop-loss" },
    { ticker: "HRHO.EGX", targetPrice: 2500, direction: "above", note: null },
  ];
  for (const a of alerts) addAlert(db, a);
  revalidatePath("/"); revalidatePath("/transactions"); revalidatePath("/watchlist");
}

export async function refreshPrices() {
  const db = getDb();
  const key = process.env.EODHD_API_KEY;
  if (!key) return { ok: false, message: "Set EODHD_API_KEY in apps/web/.env.local to fetch live prices." };
  const tickers = Array.from(new Set([
    ...listTransactions(db).map((t) => t.ticker),
    ...listAlerts(db).map((a) => a.ticker),
  ]));
  if (tickers.length === 0) return { ok: false, message: "Nothing to refresh — add positions first." };
  const to = new Date().toISOString().slice(0, 10);
  // ~150 calendar days back → ~100 trading days, enough to fill the 90-day chart
  const from = new Date(Date.now() - 150 * 864e5).toISOString().slice(0, 10);
  const client = new EodhdClient({ apiKey: key });
  const stored = await syncPrices(db, client, tickers, from, to);
  revalidatePath("/");
  return { ok: true, message: `Stored ${stored} price bar(s).` };
}
