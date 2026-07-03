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
    ["FWRY.EGX", "Fawry", "Fintech"],
  ];
  for (const [ticker, name, sector] of secs) upsertSecurity(db, { ticker, name, sector, currency: "EGP" });
  const buys: [string, number, number, string][] = [
    ["COMI.EGX", 500, 7240, "2026-06-01"],
    ["HRHO.EGX", 1200, 1890, "2026-06-02"],
    ["SWDY.EGX", 600, 6100, "2026-06-03"],
    ["FWRY.EGX", 2000, 510, "2026-06-04"],
  ];
  for (const [ticker, qty, price, tradedAt] of buys) addTransaction(db, { ticker, side: "buy", qty, price, tradedAt });
  const closes: [string, number][] = [["COMI.EGX", 8415], ["HRHO.EGX", 2260], ["SWDY.EGX", 7830], ["FWRY.EGX", 685]];
  for (const [ticker, close] of closes) upsertPrice(db, { ticker, date: "2026-07-02", open: close, high: close, low: close, close, volume: 1_000_000, source: "demo" });
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
