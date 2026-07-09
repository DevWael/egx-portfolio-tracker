import { describe, it, expect, beforeEach } from "vitest";
import { openDb, type DB } from "../../lib/core/db/connection.js";
import { migrate } from "../../lib/core/db/migrate.js";
import { upsertSecurity } from "../../lib/core/repositories/securities.js";
import {
  addTransaction,
  listTransactions,
  deleteTransaction,
} from "../../lib/core/repositories/transactions.js";

let db: DB;
beforeEach(() => {
  db = openDb(":memory:");
  migrate(db);
  upsertSecurity(db, { ticker: "COMI.EGX", name: "CIB", sector: "Banks", currency: "EGP" });
});

describe("transactions repo", () => {
  it("adds a transaction with defaults and returns id", () => {
    const t = addTransaction(db, {
      ticker: "COMI.EGX", side: "buy", qty: 500, price: 7240, tradedAt: "2026-06-01",
    });
    expect(t.id).toBeGreaterThan(0);
    expect(t.fee).toBe(0);
    expect(t.note).toBeNull();
    expect(t.price).toBe(7240);
  });

  it("defaults tradedAt to today when omitted", () => {
    const t = addTransaction(db, { ticker: "COMI.EGX", side: "buy", qty: 1, price: 100 });
    expect(t.tradedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("lists in tradedAt then id order, filterable by ticker", () => {
    addTransaction(db, { ticker: "COMI.EGX", side: "buy", qty: 1, price: 100, tradedAt: "2026-06-02" });
    addTransaction(db, { ticker: "COMI.EGX", side: "buy", qty: 1, price: 100, tradedAt: "2026-06-01" });
    const dates = listTransactions(db, "COMI.EGX").map((t) => t.tradedAt);
    expect(dates).toEqual(["2026-06-01", "2026-06-02"]);
  });

  it("deletes a transaction", () => {
    const t = addTransaction(db, { ticker: "COMI.EGX", side: "buy", qty: 1, price: 100 });
    deleteTransaction(db, t.id);
    expect(listTransactions(db)).toHaveLength(0);
  });
});
