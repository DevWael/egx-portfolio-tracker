import { z } from "zod";
import {
  type DB,
  getPortfolioSummary, listSecurities, listTransactions, getPriceHistory,
  listAlerts, evaluateAlerts,
  getSecurity, upsertSecurity, addTransaction, deleteTransaction, addAlert,
  EodhdClient, syncPrices,
} from "@egx/core";
import { toEgp, toPiasters } from "./money.js";

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
// Guard: dates must be YYYY-MM-DD. The ledger sorts by tradedAt as a string, so a
// non-ISO date would silently misorder buys/sells and corrupt weighted-avg cost / P&L.
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");

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
    inputSchema: { ticker: z.string(), from: isoDate.optional(), to: isoDate.optional() },
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
    description: "Alerts that have crossed their target (queryable state, in EGP). Idempotent — returns all crossed alerts regardless of call order.",
    inputSchema: {},
    handler: (db) => {
      evaluateAlerts(db); // stamp any newly crossed alerts first
      return listAlerts(db)
        .filter((a) => a.triggeredAt !== null)
        .map((a) => ({
          ticker: a.ticker, direction: a.direction,
          targetPrice: toEgp(a.targetPrice), triggeredAt: a.triggeredAt, note: a.note,
        }));
    },
  }),
  defineTool({
    name: "record_transaction",
    description: "Record a buy or sell. Price and fee are in EGP. Auto-creates the security if unknown (name defaults to the ticker; use upsert_security to set a real name).",
    inputSchema: {
      ticker: z.string(),
      side: z.enum(["buy", "sell"]),
      qty: z.number().int().positive(),
      price: z.number().nonnegative(),
      fee: z.number().nonnegative().optional(),
      tradedAt: isoDate.optional(),
      note: z.string().optional(),
    },
    handler: (db, a) => {
      if (!getSecurity(db, a.ticker)) upsertSecurity(db, { ticker: a.ticker, name: a.ticker, sector: null, currency: "EGP" });
      const tx = addTransaction(db, {
        ticker: a.ticker, side: a.side, qty: a.qty,
        price: toPiasters(a.price), fee: toPiasters(a.fee ?? 0), tradedAt: a.tradedAt, note: a.note ?? null,
      });
      return { ok: true, transaction: { ...tx, price: toEgp(tx.price), fee: toEgp(tx.fee) } };
    },
  }),
  defineTool({
    name: "delete_transaction",
    description: "Delete a transaction by id.",
    inputSchema: { id: z.number().int() },
    handler: (db, { id }) => { deleteTransaction(db, id); return { ok: true }; },
  }),
  defineTool({
    name: "set_alert",
    description: "Add a price-target alert. Target in EGP; direction 'above' or 'below'. Auto-creates the security if unknown.",
    inputSchema: {
      ticker: z.string(),
      targetPrice: z.number().positive(),
      direction: z.enum(["above", "below"]),
      note: z.string().optional(),
    },
    handler: (db, a) => {
      if (!getSecurity(db, a.ticker)) upsertSecurity(db, { ticker: a.ticker, name: a.ticker, sector: null, currency: "EGP" });
      const alert = addAlert(db, { ticker: a.ticker, targetPrice: toPiasters(a.targetPrice), direction: a.direction, note: a.note ?? null });
      return { ok: true, alert: { ...alert, targetPrice: toEgp(alert.targetPrice) } };
    },
  }),
  defineTool({
    name: "upsert_security",
    description: "Create or update a security's name and sector. Omitting sector keeps the existing one.",
    inputSchema: { ticker: z.string(), name: z.string(), sector: z.string().optional() },
    handler: (db, a) => {
      const existing = getSecurity(db, a.ticker);
      upsertSecurity(db, { ticker: a.ticker, name: a.name, sector: a.sector ?? existing?.sector ?? null, currency: "EGP" });
      return { ok: true };
    },
  }),
  defineTool({
    name: "refresh_prices",
    description: "Fetch end-of-day prices from EODHD for the given tickers (default: all held and watched) over the last 365 days. Requires EODHD_API_KEY.",
    inputSchema: { tickers: z.array(z.string()).optional() },
    handler: async (db, { tickers }) => {
      const key = process.env.EODHD_API_KEY;
      if (!key) return { ok: false, message: "Set EODHD_API_KEY in the environment to fetch live prices." };
      const list = tickers ?? Array.from(new Set([
        ...listTransactions(db).map((t) => t.ticker),
        ...listAlerts(db).map((al) => al.ticker),
      ]));
      if (list.length === 0) return { ok: false, message: "Nothing to refresh — add positions first." };
      const to = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
      const stored = await syncPrices(db, new EodhdClient({ apiKey: key }), list, from, to);
      return { ok: true, stored, tickers: list };
    },
  }),
];
