import { describe, it, expect, beforeEach } from "vitest";
import { openDb, type DB } from "../../lib/core/db/connection.js";
import { migrate } from "../../lib/core/db/migrate.js";
import { upsertSecurity } from "../../lib/core/repositories/securities.js";
import {
  upsertPrice, upsertPrices, getLatestPrice, getPriceHistory, getLatestPriceDate,
} from "../../lib/core/repositories/prices.js";
import type { PriceBar } from "../../lib/core/types.js";

const bar = (date: string, close: number): PriceBar => ({
  ticker: "COMI.EGX", date, open: close, high: close, low: close, close, volume: 1000, source: "eodhd",
});

let db: DB;
beforeEach(() => {
  db = openDb(":memory:");
  migrate(db);
  upsertSecurity(db, { ticker: "COMI.EGX", name: "CIB", sector: "Banks", currency: "EGP" });
});

describe("prices repo", () => {
  it("upserts and reads latest price", () => {
    upsertPrices(db, [bar("2026-06-01", 8000), bar("2026-06-02", 8415)]);
    expect(getLatestPrice(db, "COMI.EGX")?.close).toBe(8415);
    expect(getLatestPrice(db, "COMI.EGX")?.date).toBe("2026-06-02");
  });

  it("upsert overwrites same (ticker,date)", () => {
    upsertPrice(db, bar("2026-06-02", 8000));
    upsertPrice(db, bar("2026-06-02", 8415));
    expect(getLatestPrice(db, "COMI.EGX")?.close).toBe(8415);
  });

  it("returns null latest for unknown ticker", () => {
    expect(getLatestPrice(db, "NOPE.EGX")).toBeNull();
  });

  it("returns inclusive ascending history", () => {
    upsertPrices(db, [bar("2026-06-01", 100), bar("2026-06-02", 200), bar("2026-06-03", 300)]);
    const h = getPriceHistory(db, "COMI.EGX", "2026-06-01", "2026-06-02");
    expect(h.map((b) => b.date)).toEqual(["2026-06-01", "2026-06-02"]);
  });

  it("reports latest price date across all tickers", () => {
    upsertPrices(db, [bar("2026-06-01", 100), bar("2026-06-03", 300)]);
    expect(getLatestPriceDate(db)).toBe("2026-06-03");
  });
});
