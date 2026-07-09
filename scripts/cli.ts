#!/usr/bin/env tsx
import { runCli } from "../lib/cli/dispatch.js";
import { getDb } from "../lib/cli/db.js";

const { code, output } = await runCli(process.argv.slice(2), getDb());
console.log(output);
process.exit(code);
