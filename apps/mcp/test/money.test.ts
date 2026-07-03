import { describe, it, expect } from "vitest";
import { toPiasters, toEgp } from "../src/money.js";

describe("money", () => {
  it("EGP -> piasters (rounded integer)", () => {
    expect(toPiasters(84.15)).toBe(8415);
    expect(toPiasters(5.1)).toBe(510);
  });
  it("piasters -> EGP, null passthrough", () => {
    expect(toEgp(8415)).toBe(84.15);
    expect(toEgp(null)).toBeNull();
  });
  it("round-trips", () => {
    expect(toEgp(toPiasters(149.06))).toBeCloseTo(149.06, 6);
  });
});
