import { describe, it, expect, beforeEach } from "vitest";
import { openDb, migrate, type DB } from "../../lib/core/index.js";
import { runCli } from "../../lib/cli/dispatch.js";

let db: DB;
beforeEach(() => {
  db = openDb(":memory:");
  migrate(db);
});

describe("runCli", () => {
  it("list-positions on an empty portfolio returns an empty table", async () => {
    const { code, output } = await runCli(["list-positions"], db);
    expect(code).toBe(0);
    expect(output).toBe("(no results)");
  });

  it("record-transaction writes a transaction and returns it", async () => {
    const { code, output } = await runCli(
      ["record-transaction", "--ticker", "COMI.EGX", "--side", "buy", "--qty", "100", "--price", "84.15"],
      db,
    );
    expect(code).toBe(0);
    expect(output).toContain("ok: true");
  });

  it("rejects an invalid side with a validation error", async () => {
    const { code, output } = await runCli(
      ["record-transaction", "--ticker", "COMI.EGX", "--side", "hold", "--qty", "1", "--price", "1"],
      db,
    );
    expect(code).toBe(1);
    expect(output).toContain("side");
  });

  it("reports an unknown command", async () => {
    const { code, output } = await runCli(["bogus"], db);
    expect(code).toBe(1);
    expect(output).toContain("Unknown command");
  });

  it("help lists all commands", async () => {
    const { code, output } = await runCli(["help"], db);
    expect(code).toBe(0);
    expect(output).toContain("list-positions");
    expect(output).toContain("record-transaction");
  });
});
