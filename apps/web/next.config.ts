import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@egx/core"],
  serverExternalPackages: ["better-sqlite3"],
};

export default config;
