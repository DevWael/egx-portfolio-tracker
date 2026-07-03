import { describe, it, expect } from "vitest";
import { egp, pct, toPiasters } from "../lib/format.js";

describe("format", () => {
  it("formats piasters as EGP", () => {
    // Normalize U+00A0 (non-breaking space) to a regular space: this Node's
    // ICU emits NBSP between the currency code and amount for "en-EG".
    expect(egp(362000).replace(/ /g, " ")).toBe("EGP 3,620.00");
    expect(egp(null)).toBe("—");
  });
  it("formats decimal fraction as signed percent", () => {
    expect(pct(0.1623)).toBe("+16.23%");
    expect(pct(-0.1)).toBe("-10.00%");
    expect(pct(null)).toBe("—");
  });
  it("converts EGP to integer piasters", () => {
    expect(toPiasters("72.40")).toBe(7240);
    expect(toPiasters(5.1)).toBe(510);
  });
});
