import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // "server-only" (imported by lib/db.ts) resolves via this export condition
    // to a no-op under Next's webpack build; vitest needs the same condition
    // set explicitly, or the package's default export (which throws) is used.
    conditions: ["react-server"],
  },
});
