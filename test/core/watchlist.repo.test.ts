import { describe, it, expect, beforeEach } from "vitest";
import { openDb, type DB } from "../../lib/core/db/connection.js";
import { migrate } from "../../lib/core/db/migrate.js";
import { upsertSecurity } from "../../lib/core/repositories/securities.js";
import {
  addAlert, listAlerts, setAlertActive, markTriggered, deleteAlert,
} from "../../lib/core/repositories/watchlist.js";

let db: DB;
beforeEach(() => {
  db = openDb(":memory:");
  migrate(db);
  upsertSecurity(db, { ticker: "COMI.EGX", name: "CIB", sector: "Banks", currency: "EGP" });
});

describe("watchlist repo", () => {
  it("adds an alert with defaults", () => {
    const a = addAlert(db, { ticker: "COMI.EGX", targetPrice: 9000, direction: "above" });
    expect(a.id).toBeGreaterThan(0);
    expect(a.active).toBe(true);
    expect(a.triggeredAt).toBeNull();
    expect(a.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("filters active only", () => {
    const a = addAlert(db, { ticker: "COMI.EGX", targetPrice: 9000, direction: "above" });
    addAlert(db, { ticker: "COMI.EGX", targetPrice: 5000, direction: "below" });
    setAlertActive(db, a.id, false);
    expect(listAlerts(db, true)).toHaveLength(1);
    expect(listAlerts(db)).toHaveLength(2);
  });

  it("marks triggered", () => {
    const a = addAlert(db, { ticker: "COMI.EGX", targetPrice: 9000, direction: "above" });
    markTriggered(db, a.id, "2026-06-02");
    expect(listAlerts(db)[0].triggeredAt).toBe("2026-06-02");
  });

  it("deletes an alert", () => {
    const a = addAlert(db, { ticker: "COMI.EGX", targetPrice: 9000, direction: "above" });
    deleteAlert(db, a.id);
    expect(listAlerts(db)).toHaveLength(0);
  });
});
