import { describe, it, expect } from "vitest";
import { formatOutput } from "../../lib/cli/format.js";

describe("formatOutput", () => {
  it("renders an array of objects as an aligned table", () => {
    const rows = [
      { ticker: "COMI.EGX", qty: 100 },
      { ticker: "SWDY.EGX", qty: 5 },
    ];
    const out = formatOutput(rows, false);
    expect(out.split("\n")).toEqual([
      "ticker    qty",
      "COMI.EGX  100",
      "SWDY.EGX  5",
    ]);
  });

  it("renders an empty array as a placeholder", () => {
    expect(formatOutput([], false)).toBe("(no results)");
  });

  it("renders a plain object as key: value lines", () => {
    const out = formatOutput({ totalMarketValue: 1000, positions: 3 }, false);
    expect(out).toBe("totalMarketValue: 1000\npositions: 3");
  });

  it("returns raw JSON when json is true, ignoring table formatting", () => {
    const out = formatOutput({ a: 1 }, true);
    expect(JSON.parse(out)).toEqual({ a: 1 });
  });
});
