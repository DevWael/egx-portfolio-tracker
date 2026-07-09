import { describe, it, expect } from "vitest";
import { z } from "zod";
import { parseFlags } from "../../lib/cli/parse.js";

describe("parseFlags", () => {
  it("passes through strings", () => {
    const shape = { ticker: z.string() };
    expect(parseFlags(["--ticker", "COMI.EGX"], shape)).toEqual({ ticker: "COMI.EGX" });
  });

  it("coerces numbers", () => {
    const shape = { qty: z.number() };
    expect(parseFlags(["--qty", "100"], shape)).toEqual({ qty: 100 });
  });

  it("leaves optional flags absent when not passed", () => {
    const shape = { ticker: z.string().optional() };
    expect(parseFlags([], shape)).toEqual({});
  });

  it("splits array flags on comma", () => {
    const shape = { tickers: z.array(z.string()).optional() };
    expect(parseFlags(["--tickers", "COMI.EGX,SWDY.EGX"], shape)).toEqual({
      tickers: ["COMI.EGX", "SWDY.EGX"],
    });
  });

  it("converts kebab-case flags to camelCase keys", () => {
    const shape = { targetPrice: z.number() };
    expect(parseFlags(["--target-price", "84.15"], shape)).toEqual({ targetPrice: 84.15 });
  });

  it("throws on an unknown flag", () => {
    const shape = { ticker: z.string() };
    expect(() => parseFlags(["--bogus", "x"], shape)).toThrow("Unknown flag: --bogus");
  });

  it("throws when a flag is missing its value", () => {
    const shape = { ticker: z.string() };
    expect(() => parseFlags(["--ticker"], shape)).toThrow("needs a value");
  });
});
