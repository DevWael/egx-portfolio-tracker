"use server";
import { revalidatePath } from "next/cache";
import {
  upsertSecurity, addTransaction, addAlert, upsertPrice,
  listTransactions, listAlerts,
  EodhdClient, syncPrices,
} from "@egx/core";
import { getDb } from "@/lib/db";

export async function seedDemo() {
  const db = getDb();
  const secs: [string, string, string][] = [
    ["COMI.EGX", "Commercial International Bank", "Banks"],
    ["HRHO.EGX", "EFG Holding", "Financials"],
    ["SWDY.EGX", "Elsewedy Electric", "Industrials"],
    ["ABUK.EGX", "Abu Qir Fertilizers", "Industrials"],
    ["TMGH.EGX", "Talaat Moustafa Group", "Real Estate"],
    ["FWRY.EGX", "Fawry", "Fintech"],
  ];
  for (const [ticker, name, sector] of secs) upsertSecurity(db, { ticker, name, sector, currency: "EGP" });
  const buys: [string, number, number, string][] = [
    ["COMI.EGX", 500, 7240, "2026-06-01"],
    ["HRHO.EGX", 1200, 1890, "2026-06-02"],
    ["SWDY.EGX", 600, 6100, "2026-06-03"],
    ["ABUK.EGX", 300, 5520, "2026-06-04"],
    ["TMGH.EGX", 800, 4410, "2026-06-05"],
    ["FWRY.EGX", 2000, 510, "2026-06-06"],
  ];
  for (const [ticker, qty, price, tradedAt] of buys) addTransaction(db, { ticker, side: "buy", qty, price, tradedAt });
  // two price days so "day change" is meaningful: [ticker, prevClose, lastClose] in piasters
  const bars: [string, number, number][] = [
    ["COMI.EGX", 8350, 8415],
    ["HRHO.EGX", 2215, 2260],
    ["SWDY.EGX", 7700, 7830],
    ["ABUK.EGX", 5360, 5290],
    ["TMGH.EGX", 4230, 4175],
    ["FWRY.EGX", 672, 685],
  ];
  for (const [ticker, prev, last] of bars) {
    upsertPrice(db, { ticker, date: "2026-07-01", open: prev, high: prev, low: prev, close: prev, volume: 1_000_000, source: "demo" });
    upsertPrice(db, { ticker, date: "2026-07-02", open: last, high: last, low: last, close: last, volume: 1_000_000, source: "demo" });
  }
  addAlert(db, { ticker: "COMI.EGX", targetPrice: 8000, direction: "above", note: "take-profit" });
  addAlert(db, { ticker: "FWRY.EGX", targetPrice: 700, direction: "above" });
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
  const from = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const client = new EodhdClient({ apiKey: key });
  const stored = await syncPrices(db, client, tickers, from, to);
  revalidatePath("/");
  return { ok: true, message: `Stored ${stored} price bar(s).` };
}
