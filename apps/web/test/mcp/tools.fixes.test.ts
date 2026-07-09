import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import { openDb, migrate, upsertSecurity, upsertPrice, addAlert, getSecurity, type DB } from "../../lib/core/index.js";
import { tools } from "../../lib/mcp/tools.js";

const tool = (n: string) => tools.find((t) => t.name === n)!;
let db: DB;
beforeEach(() => { db = openDb(":memory:"); migrate(db); });

describe("final-review fixes", () => {
  it("record_transaction rejects a non-ISO date, accepts ISO", () => {
    const schema = z.object(tool("record_transaction").inputSchema);
    expect(schema.safeParse({ ticker: "COMI.EGX", side: "buy", qty: 1, price: 1, tradedAt: "2026-7-4" }).success).toBe(false);
    expect(schema.safeParse({ ticker: "COMI.EGX", side: "buy", qty: 1, price: 1, tradedAt: "2026-07-04" }).success).toBe(true);
  });
  it("get_price_history rejects a non-ISO from/to", () => {
    const schema = z.object(tool("get_price_history").inputSchema);
    expect(schema.safeParse({ ticker: "COMI.EGX", from: "bad-date" }).success).toBe(false);
    expect(schema.safeParse({ ticker: "COMI.EGX", from: "2026-01-01", to: "2026-07-01" }).success).toBe(true);
  });
  it("get_triggered_alerts is idempotent (state, not one-shot)", async () => {
    upsertSecurity(db, { ticker: "COMI.EGX", name: "CIB", sector: "Banks", currency: "EGP" });
    upsertPrice(db, { ticker: "COMI.EGX", date: "2026-07-02", open: 8415, high: 8415, low: 8415, close: 8415, volume: 1, source: "t" });
    addAlert(db, { ticker: "COMI.EGX", targetPrice: 8000, direction: "above", note: null });
    const h = tool("get_triggered_alerts").handler;
    expect(await h(db, {})).toHaveLength(1);
    expect(await h(db, {})).toHaveLength(1); // still 1 on a repeat call
  });
  it("upsert_security preserves sector when only the name changes", async () => {
    await tool("upsert_security").handler(db, { ticker: "COMI.EGX", name: "CIB", sector: "Banks" });
    await tool("upsert_security").handler(db, { ticker: "COMI.EGX", name: "Commercial International Bank" });
    expect(getSecurity(db, "COMI.EGX")!.sector).toBe("Banks");
  });
});
