import type { NextConfig } from "next";

// cacheComponents is intentionally off: every page is per-learner and dynamic, and the planner runs in the browser.
const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
