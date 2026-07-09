import { describe, it, expect } from "vitest";
import { POST } from "../../app/api/mcp/route.js";

function mcpRequest(body: unknown): Request {
  return new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/mcp", () => {
  it("responds to initialize with server info", async () => {
    const res = await POST(
      mcpRequest({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "test-client", version: "0.0.0" },
        },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.serverInfo.name).toBe("egx-portfolio");
  });

  it("lists tools including list_positions", async () => {
    const res = await POST(
      mcpRequest({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const names = body.result.tools.map((t: { name: string }) => t.name);
    expect(names).toContain("list_positions");
  });
});
