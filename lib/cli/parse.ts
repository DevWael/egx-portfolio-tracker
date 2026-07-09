import { z } from "zod";

function kebabToCamel(s: string): string {
  return s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

function unwrap(schema: z.ZodTypeAny): z.ZodTypeAny {
  return schema instanceof z.ZodOptional ? unwrap(schema.unwrap()) : schema;
}

export function parseFlags(argv: string[], shape: z.ZodRawShape): Record<string, unknown> {
  const known = new Set(Object.keys(shape));
  const raw: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const flagName = arg.slice(2);
    const key = kebabToCamel(flagName);
    if (!known.has(key)) {
      throw new Error(`Unknown flag: --${flagName}`);
    }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Flag --${flagName} needs a value`);
    }
    raw[key] = value;
    i++;
  }
  const coerced: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    const type = unwrap(shape[key]);
    if (type instanceof z.ZodNumber) {
      coerced[key] = Number(value);
    } else if (type instanceof z.ZodArray) {
      coerced[key] = value.split(",").map((s) => s.trim());
    } else {
      coerced[key] = value;
    }
  }
  return coerced;
}
