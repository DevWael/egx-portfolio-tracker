import { describe, it, expect } from "vitest";
import { openDb } from "../src/db/connection.js";
import { migrate } from "../src/db/migrate.js";

describe("db migration", () => {
  it("creates all tables in an in-memory db", () => {
    const db = openDb(":memory:");
    migrate(db);
    const rows = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const names = rows.map((r) => r.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "securities",
        "transactions",
        "prices",
        "watchlist_alerts",
        "settings",
      ])
    );
  });

  it("is idempotent", () => {
    const db = openDb(":memory:");
    migrate(db);
    expect(() => migrate(db)).not.toThrow();
  });
});
