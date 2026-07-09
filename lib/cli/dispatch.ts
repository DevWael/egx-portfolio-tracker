import { z, ZodError } from "zod";
import { tools, type McpTool } from "../mcp/tools.js";
import { parseFlags } from "./parse.js";
import { formatOutput } from "./format.js";
import type { DB } from "../core/index.js";

const COMMANDS: Record<string, string> = {
  "list-positions": "list_positions",
  "summary": "get_portfolio_summary",
  "transactions": "list_transactions",
  "price-history": "get_price_history",
  "watchlist": "list_watchlist",
  "alerts-triggered": "get_triggered_alerts",
  "record-transaction": "record_transaction",
  "delete-transaction": "delete_transaction",
  "set-alert": "set_alert",
  "upsert-security": "upsert_security",
  "refresh-prices": "refresh_prices",
};

function helpText(): string {
  const width = Math.max(...Object.keys(COMMANDS).map((c) => c.length));
  const lines = Object.entries(COMMANDS).map(([cmd, toolName]) => {
    const tool = tools.find((t) => t.name === toolName) as McpTool;
    return `  ${cmd.padEnd(width)}  ${tool.description}`;
  });
  return ["Usage: egx <command> [--flags] [--json]", "", "Commands:", ...lines].join("\n");
}

export async function runCli(argv: string[], db: DB): Promise<{ code: number; output: string }> {
  const json = argv.includes("--json");
  const args = argv.filter((a) => a !== "--json");
  const [command, ...rest] = args;

  if (!command || command === "help" || command === "--help" || command === "-h") {
    return { code: command ? 0 : 1, output: helpText() };
  }

  const toolName = COMMANDS[command];
  if (!toolName) {
    return { code: 1, output: `Unknown command: ${command}\n\n${helpText()}` };
  }
  const tool = tools.find((t) => t.name === toolName) as McpTool;

  let parsedArgs: unknown;
  try {
    const raw = parseFlags(rest, tool.inputSchema);
    parsedArgs = z.object(tool.inputSchema).parse(raw);
  } catch (e) {
    if (e instanceof ZodError) {
      return {
        code: 1,
        output: e.issues.map((i) => `${i.path.join(".") || command}: ${i.message}`).join("\n"),
      };
    }
    return { code: 1, output: (e as Error).message };
  }

  const result = await tool.handler(db, parsedArgs);
  const isFailure =
    typeof result === "object" && result !== null && (result as { ok?: boolean }).ok === false;
  return { code: isFailure ? 1 : 0, output: formatOutput(result, json) };
}
