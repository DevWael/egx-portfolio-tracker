import { describe, it, expect, beforeEach } from "vitest";
import { openDb, migrate, listTransactions, listAlerts, getSecurity, type DB } from "../../lib/core/index.js";
import { tools } from "../../lib/mcp/tools.js";

const tool = (name: string) => tools.find((t) => t.name === name)!;
let db: DB;
beforeEach(() => { db = openDb(":memory:"); migrate(db); });

describe("write tools", () => {
  it("record_transaction stores EGP price as piasters and reflects in summary", async () => {
    await tool("record_transaction").handler(db, { ticker: "COMI.EGX", side: "buy", qty: 100, price: 84.15, tradedAt: "2026-06-01" });
    const tx = listTransactions(db, "COMI.EGX");
    expect(tx).toHaveLength(1);
    expect(tx[0].price).toBe(8415); // stored as piasters
    expect(getSecurity(db, "COMI.EGX")).not.toBeNull(); // security auto-created
  });
  it("record_transaction keeps an existing security's name", async () => {
    await tool("upsert_security").handler(db, { ticker: "COMI.EGX", name: "Commercial International Bank", sector: "Banks" });
    await tool("record_transaction").handler(db, { ticker: "COMI.EGX", side: "buy", qty: 1, price: 84 });
    expect(getSecurity(db, "COMI.EGX")!.name).toBe("Commercial International Bank");
  });
  it("delete_transaction removes it", async () => {
    await tool("record_transaction").handler(db, { ticker: "COMI.EGX", side: "buy", qty: 1, price: 84 });
    const id = listTransactions(db)[0].id;
    await tool("delete_transaction").handler(db, { id });
    expect(listTransactions(db)).toHaveLength(0);
  });
  it("set_alert stores target in piasters", async () => {
    await tool("set_alert").handler(db, { ticker: "COMI.EGX", targetPrice: 80, direction: "above" });
    expect(listAlerts(db)[0].targetPrice).toBe(8000);
  });
  it("refresh_prices without an API key returns a message and does not throw", async () => {
    delete process.env.EODHD_API_KEY;
    const r: any = await tool("refresh_prices").handler(db, {});
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/EODHD_API_KEY/);
  });
});
