import { describe, it, expect } from "vitest";
import { openDb, type DB } from "../../lib/core/db/connection.js";
import { migrate } from "../../lib/core/db/migrate.js";
import { upsertSecurity } from "../../lib/core/repositories/securities.js";
import { getLatestPrice } from "../../lib/core/repositories/prices.js";
import { EodhdClient } from "../../lib/core/eodhd/client.js";
import { syncPrices } from "../../lib/core/services/syncPrices.js";

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
  it("continues past a failure that occurs FIRST in the batch and still stores the good ticker", async () => {
    const db: DB = openDb(":memory:");
    migrate(db);
    upsertSecurity(db, { ticker: "GOOD.EGX", name: "Good Co", sector: null, currency: "EGP" });
    upsertSecurity(db, { ticker: "BAD.EGX", name: "Bad Co", sector: null, currency: "EGP" });

    const client = new EodhdClient({ apiKey: "k", fetchImpl: mixedFetch() });

    // BAD.EGX is deliberately first: if syncPrices used `break` instead of
    // `continue` on a per-ticker EodhdError, this would return 0 and never
    // reach GOOD.EGX. Ordering the failure first is what forces that proof.
    const stored = await syncPrices(db, client, ["BAD.EGX", "GOOD.EGX"], "2026-06-01", "2026-06-02");

    expect(stored).toBe(1);
    expect(getLatestPrice(db, "GOOD.EGX")).toMatchObject({ ticker: "GOOD.EGX", close: 1020 });
    expect(getLatestPrice(db, "BAD.EGX")).toBeNull();
  });

  it("continues past a failure in the MIDDLE of a three-ticker batch", async () => {
    const db: DB = openDb(":memory:");
    migrate(db);
    upsertSecurity(db, { ticker: "GOOD.EGX", name: "Good Co", sector: null, currency: "EGP" });
    upsertSecurity(db, { ticker: "BAD.EGX", name: "Bad Co", sector: null, currency: "EGP" });
    upsertSecurity(db, { ticker: "GOOD2.EGX", name: "Good Co 2", sector: null, currency: "EGP" });

    const client = new EodhdClient({ apiKey: "k", fetchImpl: mixedFetch() });

    const stored = await syncPrices(
      db, client, ["GOOD.EGX", "BAD.EGX", "GOOD2.EGX"], "2026-06-01", "2026-06-02"
    );

    expect(stored).toBe(2);
    expect(getLatestPrice(db, "GOOD.EGX")).toMatchObject({ ticker: "GOOD.EGX", close: 1020 });
    expect(getLatestPrice(db, "GOOD2.EGX")).toMatchObject({ ticker: "GOOD2.EGX", close: 1020 });
    expect(getLatestPrice(db, "BAD.EGX")).toBeNull();
  });
});
