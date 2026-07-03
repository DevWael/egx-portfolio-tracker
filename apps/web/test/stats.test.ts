import { describe, it, expect } from "vitest";
import { returnOver, annualizedVol, maxDrawdown, computeStats } from "../lib/stats.js";

describe("stats helpers", () => {
  it("returnOver computes N-back return or null", () => {
    const c = [100, 110, 105, 120];
    expect(returnOver(c, 1)).toBeCloseTo((120 - 105) / 105, 6);
    expect(returnOver(c, 3)).toBeCloseTo(0.2, 6);
    expect(returnOver(c, 4)).toBeNull();
  });
  it("annualizedVol is 0 for constant-growth and positive for varying", () => {
    expect(annualizedVol([100, 110, 121])).toBeCloseTo(0, 6); // returns [0.1, 0.1] -> stdev 0
    expect(annualizedVol([100])).toBeNull();
    expect(annualizedVol([100, 110, 105, 120])!).toBeGreaterThan(0);
  });
  it("maxDrawdown finds the largest peak-to-trough drop (<= 0)", () => {
    expect(maxDrawdown([100, 110, 105, 120])!).toBeCloseTo((105 - 110) / 110, 6);
    expect(maxDrawdown([100, 90, 80])!).toBeCloseTo((80 - 100) / 100, 6);
    expect(maxDrawdown([])).toBeNull();
  });
});

describe("computeStats", () => {
  const bars = [
    { date: "2026-06-29", close: 100, volume: 10 },
    { date: "2026-06-30", close: 110, volume: 20 },
    { date: "2026-07-01", close: 105, volume: 30 },
    { date: "2026-07-02", close: 120, volume: 40 },
  ];
  it("computes 52w hi/lo, pct-from, volume", () => {
    const s = computeStats(bars);
    expect(s.high52).toBe(120);
    expect(s.low52).toBe(100);
    expect(s.pctFromHigh).toBeCloseTo(0, 6);
    expect(s.pctFromLow).toBeCloseTo(0.2, 6);
    expect(s.lastVolume).toBe(40);
    expect(s.avgVolume).toBeCloseTo(25, 6);
  });
  it("returns nulls for periods with insufficient history", () => {
    const s = computeStats(bars);
    expect(s.returns.m1).toBeNull(); // needs 21 bars
    expect(s.returns.y1).toBeNull();
  });
  it("empty input yields all nulls", () => {
    const s = computeStats([]);
    expect(s.high52).toBeNull();
    expect(s.returns.m3).toBeNull();
    expect(s.volatilityAnnual).toBeNull();
    expect(s.avgVolume).toBeNull();
  });
  it("computes YTD from the previous year's last close", () => {
    const bars = [
      { date: "2025-12-31", close: 100, volume: 1 },
      { date: "2026-06-01", close: 120, volume: 1 },
      { date: "2026-07-02", close: 150, volume: 1 },
    ];
    expect(computeStats(bars).returns.ytd).toBeCloseTo(0.5, 6); // (150-100)/100
  });
  it("52-week high/low uses only the last 252 bars", () => {
    const bars = Array.from({ length: 260 }, (_, i) => ({
      date: `2026-${String(1 + (i % 9)).padStart(2, "0")}-01`, // dates only need to be strings here
      close: i < 8 ? 1000 : 200 + (i % 50),
      volume: 1,
    }));
    const s = computeStats(bars);
    expect(s.high52).toBeLessThan(1000); // the old 1000s are outside the 252 window
    expect(s.high52).toBe(249);          // max of 200 + (i%50) within window
  });
});
