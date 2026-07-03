import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@egx/core"],
  serverExternalPackages: ["better-sqlite3"],
  // Turbopack (Next's default bundler) can't resolve relative TS imports
  // written with a ".js" specifier (our ESM convention) back to their ".ts"
  // source files, so this app builds on webpack instead (see package.json
  // scripts). This alias is what makes that resolution work under webpack.
  experimental: {
    extensionAlias: { ".js": [".ts", ".tsx", ".js"] },
  },
};

export default config;
