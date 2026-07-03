import { describe, it, expect } from "vitest";
import {
  openDb, migrate, upsertSecurity, addTransaction, addAlert,
  EodhdClient, syncPrices, getPortfolioSummary, buildDigest,
} from "../src/index.js";

function fakeFetch(rows: unknown): typeof fetch {
  return (async () => new Response(JSON.stringify(rows), { status: 200 })) as unknown as typeof fetch;
}

describe("core integration", () => {
  it("runs the full flow: security -> tx -> sync -> summary -> digest", async () => {
    const db = openDb(":memory:");
    migrate(db);
    upsertSecurity(db, { ticker: "COMI.EGX", name: "CIB", sector: "Banks", currency: "EGP" });
    addTransaction(db, { ticker: "COMI.EGX", side: "buy", qty: 100, price: 1000, tradedAt: "2026-06-01" });
    addAlert(db, { ticker: "COMI.EGX", targetPrice: 1400, direction: "above" });

    const client = new EodhdClient({
      apiKey: "k",
      fetchImpl: fakeFetch([{ date: "2026-06-02", open: 1500 / 100, high: 1500 / 100, low: 1500 / 100, close: 1500 / 100, volume: 10 }]),
    });
    const stored = await syncPrices(db, client, ["COMI.EGX"], "2026-06-01", "2026-06-02");
    expect(stored).toBe(1);

    const summary = getPortfolioSummary(db);
    expect(summary.totalMarketValue).toBe(150000);
    expect(summary.totalUnrealizedPnl).toBe(50000);

    const digest = buildDigest(db);
    expect(digest.triggered).toHaveLength(1);
    expect(digest.topMovers[0].ticker).toBe("COMI.EGX");
  });
});
