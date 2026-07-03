import { z } from "zod";
import {
  type DB,
  getPortfolioSummary, listSecurities, listTransactions, getPriceHistory,
  listAlerts, evaluateAlerts,
} from "@egx/core";
import { toEgp } from "./money.js";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: z.ZodRawShape;
  handler: (db: DB, args: any) => unknown | Promise<unknown>;
}

export function defineTool<S extends z.ZodRawShape>(t: {
  name: string;
  description: string;
  inputSchema: S;
  handler: (db: DB, args: z.infer<z.ZodObject<S>>) => unknown | Promise<unknown>;
}): McpTool {
  return t as unknown as McpTool;
}

const TODAY = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

export const tools: McpTool[] = [
  defineTool({
    name: "list_positions",
    description: "Current holdings with quantity, average cost, last close, market value and unrealized P&L (all in EGP).",
    inputSchema: {},
    handler: (db) => {
      const secs = new Map(listSecurities(db).map((s) => [s.ticker, s]));
      const s = getPortfolioSummary(db);
      return s.holdings.map((h) => ({
        ticker: h.ticker,
        name: secs.get(h.ticker)?.name ?? null,
        sector: secs.get(h.ticker)?.sector ?? null,
        qty: h.qty,
        avgCost: toEgp(h.avgCost),
        lastClose: toEgp(h.lastClose),
        marketValue: toEgp(h.marketValue),
        unrealizedPnl: toEgp(h.unrealizedPnl),
        unrealizedPnlPct: h.unrealizedPnlPct,
        asOf: s.asOf,
      }));
    },
  }),
  defineTool({
    name: "get_portfolio_summary",
    description: "Portfolio totals in EGP: market value, cost basis, unrealized and realized P&L, position count, and the 'prices as of' date.",
    inputSchema: {},
    handler: (db) => {
      const s = getPortfolioSummary(db);
      return {
        totalMarketValue: toEgp(s.totalMarketValue),
        totalCostBasis: toEgp(s.totalCostBasis),
        totalUnrealizedPnl: toEgp(s.totalUnrealizedPnl),
        totalUnrealizedPnlPct: s.totalUnrealizedPnlPct,
        totalRealizedPnl: toEgp(s.totalRealizedPnl),
        positions: s.holdings.length,
        asOf: s.asOf,
      };
    },
  }),
  defineTool({
    name: "list_transactions",
    description: "Transaction ledger (buys/sells), optionally filtered by ticker. Prices and fees in EGP.",
    inputSchema: { ticker: z.string().optional() },
    handler: (db, { ticker }) =>
      listTransactions(db, ticker).map((t) => ({
        id: t.id, ticker: t.ticker, side: t.side, qty: t.qty,
        price: toEgp(t.price), fee: toEgp(t.fee), tradedAt: t.tradedAt, note: t.note,
      })),
  }),
  defineTool({
    name: "get_price_history",
    description: "Daily OHLCV price history for a ticker (EGP). Defaults to the last 365 days.",
    inputSchema: { ticker: z.string(), from: z.string().optional(), to: z.string().optional() },
    handler: (db, { ticker, from, to }) =>
      getPriceHistory(db, ticker, from ?? daysAgo(365), to ?? TODAY()).map((b) => ({
        date: b.date, open: toEgp(b.open), high: toEgp(b.high), low: toEgp(b.low), close: toEgp(b.close), volume: b.volume,
      })),
  }),
  defineTool({
    name: "list_watchlist",
    description: "Watchlist alerts with current status (evaluated against the latest close). Targets in EGP.",
    inputSchema: {},
    handler: (db) => {
      evaluateAlerts(db); // stamp any newly crossed alerts first
      return listAlerts(db).map((a) => ({
        id: a.id, ticker: a.ticker, targetPrice: toEgp(a.targetPrice),
        direction: a.direction, active: a.active, note: a.note, triggeredAt: a.triggeredAt,
      }));
    },
  }),
  defineTool({
    name: "get_triggered_alerts",
    description: "Alerts crossed at the latest close (ticker, direction, target and the close that crossed it, in EGP).",
    inputSchema: {},
    handler: (db) =>
      evaluateAlerts(db).map((t) => ({
        ticker: t.alert.ticker, direction: t.alert.direction,
        targetPrice: toEgp(t.alert.targetPrice), lastClose: toEgp(t.lastClose), lastCloseDate: t.lastCloseDate,
      })),
  }),
];
