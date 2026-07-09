import { describe, it, expect, beforeEach } from "vitest";
import { openDb, type DB } from "../../lib/core/db/connection.js";
import { migrate } from "../../lib/core/db/migrate.js";
import {
  upsertSecurity,
  getSecurity,
  listSecurities,
} from "../../lib/core/repositories/securities.js";

let db: DB;
beforeEach(() => {
  db = openDb(":memory:");
  migrate(db);
});

describe("securities repo", () => {
  it("inserts and reads a security", () => {
    upsertSecurity(db, { ticker: "COMI.EGX", name: "CIB", sector: "Banks", currency: "EGP" });
    expect(getSecurity(db, "COMI.EGX")).toEqual({
      ticker: "COMI.EGX", name: "CIB", sector: "Banks", currency: "EGP",
    });
  });

  it("upsert overwrites name and sector", () => {
    upsertSecurity(db, { ticker: "COMI.EGX", name: "CIB", sector: "Banks", currency: "EGP" });
    upsertSecurity(db, { ticker: "COMI.EGX", name: "Commercial Intl Bank", sector: "Financials", currency: "EGP" });
    expect(getSecurity(db, "COMI.EGX")?.name).toBe("Commercial Intl Bank");
    expect(getSecurity(db, "COMI.EGX")?.sector).toBe("Financials");
  });

  it("returns null for unknown ticker", () => {
    expect(getSecurity(db, "NOPE.EGX")).toBeNull();
  });

  it("lists securities sorted by ticker", () => {
    upsertSecurity(db, { ticker: "HRHO.EGX", name: "EFG", sector: "Financials", currency: "EGP" });
    upsertSecurity(db, { ticker: "COMI.EGX", name: "CIB", sector: "Banks", currency: "EGP" });
    expect(listSecurities(db).map((s) => s.ticker)).toEqual(["COMI.EGX", "HRHO.EGX"]);
  });
});
