import "server-only";
import { getSecurity, getPriceHistory, listTransactions, getPortfolioSummary, type HoldingValuation, type Transaction } from "@egx/core";
import { getDb } from "./db.js";
import type { StatBar } from "./stats.js";

export interface TickerDetail {
  ticker: string;
  name: string;
  sector: string | null;
  lastClose: number | null;
  lastDate: string | null;
  position: HoldingValuation | null;
  bars: StatBar[]; // full series (oldest→newest); stats are computed client-side per selected period
  txns: Transaction[];
}

export function tickerDetail(symbol: string): TickerDetail | null {
  const db = getDb();
  const sec = getSecurity(db, symbol);
  if (!sec) return null;
  const prices = getPriceHistory(db, symbol, "0000-01-01", "9999-12-31");
  const last = prices[prices.length - 1] ?? null;
  const position = getPortfolioSummary(db).holdings.find((h) => h.ticker === symbol) ?? null;
  return {
    ticker: symbol,
    name: sec.name,
    sector: sec.sector,
    lastClose: last ? last.close : null,
    lastDate: last ? last.date : null,
    position,
    bars: prices.map((b) => ({ date: b.date, close: b.close, volume: b.volume })),
    txns: listTransactions(db, symbol),
  };
}
