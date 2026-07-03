import { describe, it, expect, beforeEach } from "vitest";
import { openDb, type DB } from "../src/db/connection.js";
import { migrate } from "../src/db/migrate.js";
import { upsertSecurity } from "../src/repositories/securities.js";
import { addTransaction } from "../src/repositories/transactions.js";
import { upsertPrice } from "../src/repositories/prices.js";
import { getPortfolioSummary, valueHoldings } from "../src/portfolio/summary.js";
import { deriveHoldings } from "../src/portfolio/holdings.js";
import { listTransactions } from "../src/repositories/transactions.js";

let db: DB;
beforeEach(() => {
  db = openDb(":memory:");
  migrate(db);
  upsertSecurity(db, { ticker: "COMI.EGX", name: "CIB", sector: "Banks", currency: "EGP" });
});

describe("valuation + summary", () => {
  it("values a holding against latest close", () => {
    addTransaction(db, { ticker: "COMI.EGX", side: "buy", qty: 100, price: 1000, tradedAt: "2026-06-01" });
    upsertPrice(db, { ticker: "COMI.EGX", date: "2026-06-02", open: 1200, high: 1200, low: 1200, close: 1200, volume: 1, source: "eodhd" });
    const h = valueHoldings(db, deriveHoldings(listTransactions(db)));
    expect(h[0].lastClose).toBe(1200);
    expect(h[0].marketValue).toBe(120000);
    expect(h[0].unrealizedPnl).toBe(20000); // 120000 - 100000
    expect(h[0].unrealizedPnlPct).toBeCloseTo(0.2, 5);
  });

  it("leaves valuation null when no price exists", () => {
    addTransaction(db, { ticker: "COMI.EGX", side: "buy", qty: 100, price: 1000 });
    const h = valueHoldings(db, deriveHoldings(listTransactions(db)));
    expect(h[0].lastClose).toBeNull();
    expect(h[0].marketValue).toBeNull();
    expect(h[0].unrealizedPnl).toBeNull();
  });

  it("aggregates portfolio summary totals", () => {
    addTransaction(db, { ticker: "COMI.EGX", side: "buy", qty: 100, price: 1000, tradedAt: "2026-06-01" });
    upsertPrice(db, { ticker: "COMI.EGX", date: "2026-06-02", open: 1200, high: 1200, low: 1200, close: 1200, volume: 1, source: "eodhd" });
    const s = getPortfolioSummary(db);
    expect(s.totalMarketValue).toBe(120000);
    expect(s.totalCostBasis).toBe(100000);
    expect(s.totalUnrealizedPnl).toBe(20000);
    expect(s.totalUnrealizedPnlPct).toBeCloseTo(0.2, 5);
    expect(s.asOf).toBe("2026-06-02");
  });

  it("empty portfolio yields zeros", () => {
    const s = getPortfolioSummary(db);
    expect(s.totalMarketValue).toBe(0);
    expect(s.totalUnrealizedPnlPct).toBe(0);
    expect(s.holdings).toEqual([]);
    expect(s.asOf).toBeNull();
  });

  it("counts realized pnl from a fully-closed position", () => {
    addTransaction(db, { ticker: "COMI.EGX", side: "buy", qty: 100, price: 1000, tradedAt: "2026-06-01" });
    addTransaction(db, { ticker: "COMI.EGX", side: "sell", qty: 100, price: 1500, tradedAt: "2026-06-02" });
    const s = getPortfolioSummary(db);
    expect(s.holdings).toEqual([]);
    expect(s.totalRealizedPnl).toBe(50000);
  });

  it("counts realized pnl from a partial sell alongside the still-open holding", () => {
    addTransaction(db, { ticker: "COMI.EGX", side: "buy", qty: 200, price: 1000, tradedAt: "2026-06-01" });
    addTransaction(db, { ticker: "COMI.EGX", side: "sell", qty: 50, price: 1500, tradedAt: "2026-06-02" });
    const s = getPortfolioSummary(db);
    expect(s.totalRealizedPnl).toBe(25000);
    expect(s.holdings.map((h) => h.ticker)).toEqual(["COMI.EGX"]);
  });
});
