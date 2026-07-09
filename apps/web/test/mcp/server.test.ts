import { describe, it, expect } from "vitest";
import { createServer } from "../../lib/mcp/server.js";
import { tools } from "../../lib/mcp/tools.js";

describe("server", () => {
  it("builds without throwing and registers every tool", () => {
    const server = createServer();
    expect(server).toBeTruthy();
    // registry sanity: unique names, all read+write tools present
    const names = tools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const n of ["list_positions", "get_portfolio_summary", "record_transaction", "set_alert", "refresh_prices"]) {
      expect(names).toContain(n);
    }
  });
});
