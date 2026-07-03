import { describe, it, expect, beforeEach } from "vitest";
import { openDb, type DB } from "../src/db/connection.js";
import { migrate } from "../src/db/migrate.js";
import { upsertSecurity } from "../src/repositories/securities.js";
import { upsertPrice } from "../src/repositories/prices.js";
import { addAlert, listAlerts } from "../src/repositories/watchlist.js";
import { evaluateAlerts } from "../src/alerts/evaluate.js";

const price = (close: number) => ({ ticker: "COMI.EGX", date: "2026-06-02", open: close, high: close, low: close, close, volume: 1, source: "eodhd" });

let db: DB;
beforeEach(() => {
  db = openDb(":memory:");
  migrate(db);
  upsertSecurity(db, { ticker: "COMI.EGX", name: "CIB", sector: "Banks", currency: "EGP" });
});

describe("evaluateAlerts", () => {
  it("triggers an 'above' alert when close crosses target", () => {
    addAlert(db, { ticker: "COMI.EGX", targetPrice: 8000, direction: "above" });
    upsertPrice(db, price(8415));
    const t = evaluateAlerts(db);
    expect(t).toHaveLength(1);
    expect(t[0].lastClose).toBe(8415);
    expect(listAlerts(db)[0].triggeredAt).toBe("2026-06-02");
  });

  it("does not trigger 'above' below target", () => {
    addAlert(db, { ticker: "COMI.EGX", targetPrice: 9000, direction: "above" });
    upsertPrice(db, price(8415));
    expect(evaluateAlerts(db)).toHaveLength(0);
  });

  it("triggers 'below' when close at or under target", () => {
    addAlert(db, { ticker: "COMI.EGX", targetPrice: 5000, direction: "below" });
    upsertPrice(db, price(5000));
    expect(evaluateAlerts(db)).toHaveLength(1);
  });

  it("skips already-triggered alerts on re-run", () => {
    addAlert(db, { ticker: "COMI.EGX", targetPrice: 8000, direction: "above" });
    upsertPrice(db, price(8415));
    evaluateAlerts(db);
    expect(evaluateAlerts(db)).toHaveLength(0);
  });
});
