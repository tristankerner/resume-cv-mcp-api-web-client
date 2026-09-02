import path from "node:path";
import { defineConfig } from "vitest/config";

// A separate config from vite.config.ts on purpose: the singlefile/Tailwind
// plugins there have no role in running tests, and keeping them out avoids
// vitest paying for a full app build on every run.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
