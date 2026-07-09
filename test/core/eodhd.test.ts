import { describe, it, expect } from "vitest";
import { EodhdClient, EodhdError } from "../../lib/core/eodhd/client.js";

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

  it("throws EodhdError on network failure", async () => {
    const fetchImpl = (async () => {
      throw new Error("getaddrinfo ENOTFOUND eodhd.com");
    }) as unknown as typeof fetch;
    const client = new EodhdClient({ apiKey: "k", fetchImpl });
    await expect(client.getEod("COMI.EGX", "2026-06-01", "2026-06-02")).rejects.toBeInstanceOf(EodhdError);
  });

  it("throws EodhdError when a 200 body is not an array", async () => {
    const client = new EodhdClient({ apiKey: "k", fetchImpl: fakeFetch(200, { error: "not a list" }) });
    await expect(client.getEod("COMI.EGX", "2026-06-01", "2026-06-02")).rejects.toBeInstanceOf(EodhdError);
  });

  it("throws EodhdError when a 200 body is not valid JSON", async () => {
    const fetchImpl = (async () =>
      new Response("<html>not json</html>", { status: 200 })) as unknown as typeof fetch;
    const client = new EodhdClient({ apiKey: "k", fetchImpl });
    await expect(client.getEod("COMI.EGX", "2026-06-01", "2026-06-02")).rejects.toBeInstanceOf(EodhdError);
  });

  it("surfaces a plan/range warning array instead of emitting NaN bars", async () => {
    const client = new EodhdClient({
      apiKey: "k",
      fetchImpl: fakeFetch(200, [{ warning: "Data is limited by one year as you have free subscription" }]),
    });
    await expect(client.getEod("COMI.EGX", "2020-01-01", "2020-02-01")).rejects.toBeInstanceOf(EodhdError);
    await expect(client.getEod("COMI.EGX", "2020-01-01", "2020-02-01")).rejects.toThrow(/one year/);
  });

  it("skips non-bar rows and keeps valid bars", async () => {
    const client = new EodhdClient({
      apiKey: "k",
      fetchImpl: fakeFetch(200, [
        { date: "2026-06-02", open: 80, high: 85, low: 79, close: 84.15, volume: 1000 },
        { warning: "partial" },
      ]),
    });
    const bars = await client.getEod("COMI.EGX", "2026-06-01", "2026-06-02");
    expect(bars).toHaveLength(1);
    expect(bars[0].close).toBe(8415);
  });
});
