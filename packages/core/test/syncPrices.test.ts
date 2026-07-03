import { describe, it, expect } from "vitest";
import { openDb, type DB } from "../src/db/connection.js";
import { migrate } from "../src/db/migrate.js";
import { upsertSecurity } from "../src/repositories/securities.js";
import { getLatestPrice } from "../src/repositories/prices.js";
import { EodhdClient } from "../src/eodhd/client.js";
import { syncPrices } from "../src/services/syncPrices.js";

function mixedFetch(): typeof fetch {
  return (async (url: string) => {
    if (String(url).includes("BAD.EGX")) {
      return new Response(JSON.stringify({ message: "server error" }), { status: 500 });
    }
    return new Response(
      JSON.stringify([
        { date: "2026-06-02", open: 10, high: 10.5, low: 9.5, close: 10.2, volume: 100 },
      ]),
      { status: 200 }
    );
  }) as unknown as typeof fetch;
}

describe("syncPrices (network/malformed degradation)", () => {
  it("stores the good ticker and skips the bad ticker without throwing", async () => {
    const db: DB = openDb(":memory:");
    migrate(db);
    upsertSecurity(db, { ticker: "GOOD.EGX", name: "Good Co", sector: null, currency: "EGP" });
    upsertSecurity(db, { ticker: "BAD.EGX", name: "Bad Co", sector: null, currency: "EGP" });

    const client = new EodhdClient({ apiKey: "k", fetchImpl: mixedFetch() });

    const stored = await syncPrices(db, client, ["GOOD.EGX", "BAD.EGX"], "2026-06-01", "2026-06-02");

    expect(stored).toBe(1);
    expect(getLatestPrice(db, "GOOD.EGX")).toMatchObject({ ticker: "GOOD.EGX", close: 1020 });
    expect(getLatestPrice(db, "BAD.EGX")).toBeNull();
  });
});
