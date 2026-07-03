import { describe, it, expect, beforeEach } from "vitest";
import { openDb, type DB } from "../src/db/connection.js";
import { migrate } from "../src/db/migrate.js";
import { upsertSecurity } from "../src/repositories/securities.js";
import { addTransaction } from "../src/repositories/transactions.js";
import { upsertPrice } from "../src/repositories/prices.js";
import { addAlert } from "../src/repositories/watchlist.js";
import { buildDigest } from "../src/digest/build.js";

const priceBar = (ticker: string, close: number) => ({ ticker, date: "2026-06-02", open: close, high: close, low: close, close, volume: 1, source: "eodhd" });

let db: DB;
beforeEach(() => {
  db = openDb(":memory:");
  migrate(db);
  for (const [t, n] of [["COMI.EGX", "CIB"], ["HRHO.EGX", "EFG"], ["FWRY.EGX", "Fawry"]] as const) {
    upsertSecurity(db, { ticker: t, name: n, sector: "X", currency: "EGP" });
  }
});

describe("buildDigest", () => {
  it("summarizes value, triggered alerts, and top movers", () => {
    addTransaction(db, { ticker: "COMI.EGX", side: "buy", qty: 100, price: 1000, tradedAt: "2026-06-01" });
    addTransaction(db, { ticker: "HRHO.EGX", side: "buy", qty: 100, price: 1000, tradedAt: "2026-06-01" });
    upsertPrice(db, priceBar("COMI.EGX", 1500)); // +50%
    upsertPrice(db, priceBar("HRHO.EGX", 900));  // -10%
    addAlert(db, { ticker: "COMI.EGX", targetPrice: 1400, direction: "above" });

    const d = buildDigest(db);
    expect(d.date).toBe("2026-06-02");
    expect(d.totalMarketValue).toBe(240000);
    expect(d.triggered).toHaveLength(1);
    expect(d.topMovers[0].ticker).toBe("COMI.EGX"); // biggest abs move first
    expect(d.topMovers.length).toBeLessThanOrEqual(3);
  });

  it("empty portfolio yields an empty-but-valid digest", () => {
    const d = buildDigest(db);
    expect(d.totalMarketValue).toBe(0);
    expect(d.triggered).toEqual([]);
    expect(d.topMovers).toEqual([]);
    expect(d.date).toBeNull();
  });
});
