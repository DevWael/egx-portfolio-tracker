import { describe, it, expect } from "vitest";
import { EodhdClient, EodhdError } from "../src/eodhd/client.js";

function fakeFetch(status: number, body: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe("EodhdClient", () => {
  it("maps EOD floats to piaster PriceBars", async () => {
    const client = new EodhdClient({
      apiKey: "k",
      fetchImpl: fakeFetch(200, [
        { date: "2026-06-02", open: 80.0, high: 85.2, low: 79.5, close: 84.15, volume: 1000 },
      ]),
    });
    const bars = await client.getEod("COMI.EGX", "2026-06-01", "2026-06-02");
    expect(bars[0]).toEqual({
      ticker: "COMI.EGX", date: "2026-06-02",
      open: 8000, high: 8520, low: 7950, close: 8415, volume: 1000, source: "eodhd",
    });
  });

  it("filters search results to .EGX", async () => {
    const client = new EodhdClient({
      apiKey: "k",
      fetchImpl: fakeFetch(200, [
        { Code: "COMI", Exchange: "EGX", Name: "Commercial International Bank" },
        { Code: "AAPL", Exchange: "US", Name: "Apple" },
      ]),
    });
    const res = await client.search("COMI");
    expect(res).toEqual([{ ticker: "COMI.EGX", name: "Commercial International Bank" }]);
  });

  it("throws EodhdError on non-2xx", async () => {
    const client = new EodhdClient({ apiKey: "k", fetchImpl: fakeFetch(402, { message: "plan" }) });
    await expect(client.getEod("COMI.EGX", "2026-06-01", "2026-06-02")).rejects.toBeInstanceOf(EodhdError);
    await expect(client.getEod("COMI.EGX", "2026-06-01", "2026-06-02")).rejects.toMatchObject({ status: 402 });
  });
});
