import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { tools } from "./tools.js";
import { getDb } from "../db.js";

export function createServer(): McpServer {
  const server = new McpServer({ name: "egx-portfolio", version: "0.1.0" });
  for (const t of tools) {
    server.registerTool(
      t.name,
      { description: t.description, inputSchema: t.inputSchema },
      async (args: unknown) => {
        try {
          const result = await t.handler(getDb(), args ?? {});
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
        } catch (e) {
          return { content: [{ type: "text" as const, text: `Error: ${(e as Error).message}` }], isError: true };
        }
      },
    );
  }
  return server;
}
