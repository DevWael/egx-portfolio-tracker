import { describe, it, expect, beforeEach } from "vitest";
import { openDb, migrate, upsertSecurity, addTransaction, upsertPrice, addAlert, type DB } from "../../lib/core/index.js";
import { tools } from "../../lib/mcp/tools.js";

const tool = (name: string) => tools.find((t) => t.name === name)!;
let db: DB;
beforeEach(() => {
  db = openDb(":memory:");
  migrate(db);
  upsertSecurity(db, { ticker: "COMI.EGX", name: "CIB", sector: "Banks", currency: "EGP" });
  addTransaction(db, { ticker: "COMI.EGX", side: "buy", qty: 100, price: 7000, tradedAt: "2026-06-01" }); // 70.00 EGP
  upsertPrice(db, { ticker: "COMI.EGX", date: "2026-07-02", open: 8415, high: 8415, low: 8415, close: 8415, volume: 1000, source: "test" });
  addAlert(db, { ticker: "COMI.EGX", targetPrice: 8000, direction: "above", note: "tp" }); // 80.00
});

describe("read tools", () => {
  it("list_positions returns holdings in EGP", async () => {
    const res: any = await tool("list_positions").handler(db, {});
    expect(res[0]).toMatchObject({ ticker: "COMI.EGX", qty: 100, avgCost: 70, lastClose: 84.15 });
    expect(res[0].marketValue).toBeCloseTo(8415, 2); // 100 * 84.15
  });
  it("get_portfolio_summary totals in EGP", async () => {
    const s: any = await tool("get_portfolio_summary").handler(db, {});
    expect(s.totalMarketValue).toBeCloseTo(8415, 2);
    expect(s.totalCostBasis).toBeCloseTo(7000, 2);
    expect(s.positions).toBe(1);
    expect(s.asOf).toBe("2026-07-02");
  });
  it("list_transactions returns prices in EGP", async () => {
    const t: any = await tool("list_transactions").handler(db, { ticker: "COMI.EGX" });
    expect(t[0]).toMatchObject({ side: "buy", qty: 100, price: 70 });
  });
  it("get_price_history returns OHLC in EGP", async () => {
    const h: any = await tool("get_price_history").handler(db, { ticker: "COMI.EGX", from: "2026-01-01", to: "2026-12-31" });
    expect(h[0]).toMatchObject({ date: "2026-07-02", close: 84.15 });
  });
  it("list_watchlist evaluates and shows the crossed alert", async () => {
    const a: any = await tool("list_watchlist").handler(db, {});
    expect(a[0]).toMatchObject({ ticker: "COMI.EGX", targetPrice: 80, direction: "above" });
    expect(a[0].triggeredAt).toBe("2026-07-02"); // 84.15 >= 80
  });
  it("get_triggered_alerts lists crossed alerts", async () => {
    const t: any = await tool("get_triggered_alerts").handler(db, {});
    expect(t).toHaveLength(1);
    expect(t[0].ticker).toBe("COMI.EGX");
  });
});
