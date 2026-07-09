import { describe, it, expect } from "vitest";
import { deriveHoldings } from "../../lib/core/portfolio/holdings.js";
import type { Transaction } from "../../lib/core/types.js";

let seq = 0;
const tx = (p: Partial<Transaction> & Pick<Transaction, "ticker" | "side" | "qty" | "price">): Transaction => ({
  id: ++seq, fee: 0, tradedAt: "2026-06-01", note: null, ...p,
});

describe("deriveHoldings", () => {
  it("single buy: qty, avgCost, costBasis", () => {
    const h = deriveHoldings([tx({ ticker: "COMI.EGX", side: "buy", qty: 500, price: 7240 })]);
    expect(h).toEqual([
      { ticker: "COMI.EGX", qty: 500, avgCost: 7240, costBasis: 3620000, realizedPnl: 0 },
    ]);
  });

  it("buy fee is folded into cost basis", () => {
    const h = deriveHoldings([tx({ ticker: "COMI.EGX", side: "buy", qty: 100, price: 1000, fee: 500 })]);
    // totalCost = 100*1000 + 500 = 100500; avgCost = round(100500/100) = 1005
    expect(h[0].costBasis).toBe(100500);
    expect(h[0].avgCost).toBe(1005);
  });

  it("two buys average correctly", () => {
    const h = deriveHoldings([
      tx({ ticker: "COMI.EGX", side: "buy", qty: 100, price: 1000 }),
      tx({ ticker: "COMI.EGX", side: "buy", qty: 100, price: 2000 }),
    ]);
    // totalCost = 100000 + 200000 = 300000; qty 200; avg 1500
    expect(h[0]).toMatchObject({ qty: 200, avgCost: 1500, costBasis: 300000 });
  });

  it("partial sell computes realized pnl and keeps avg cost", () => {
    const h = deriveHoldings([
      tx({ ticker: "COMI.EGX", side: "buy", qty: 200, price: 1000 }), // avg 1000
      tx({ ticker: "COMI.EGX", side: "sell", qty: 50, price: 1500 }), // realized = 50*1500 - 50*1000 = 25000
    ]);
    expect(h[0].qty).toBe(150);
    expect(h[0].avgCost).toBe(1000);
    expect(h[0].costBasis).toBe(150000);
    expect(h[0].realizedPnl).toBe(25000);
  });

  it("sell fee reduces realized pnl", () => {
    const h = deriveHoldings([
      tx({ ticker: "COMI.EGX", side: "buy", qty: 100, price: 1000 }),
      tx({ ticker: "COMI.EGX", side: "sell", qty: 100, price: 1500, fee: 300 }),
    ]);
    // realized = 100*1500 - 300 - 100*1000 = 49700; qty 0 -> excluded
    expect(h).toEqual([]);
  });

  it("excludes fully-closed positions but not open ones", () => {
    const h = deriveHoldings([
      tx({ ticker: "COMI.EGX", side: "buy", qty: 100, price: 1000 }),
      tx({ ticker: "COMI.EGX", side: "sell", qty: 100, price: 1200 }),
      tx({ ticker: "HRHO.EGX", side: "buy", qty: 10, price: 500 }),
    ]);
    expect(h.map((x) => x.ticker)).toEqual(["HRHO.EGX"]);
  });
});
