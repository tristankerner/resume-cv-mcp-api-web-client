import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Bundled to one HTML file — see README.md. That property is load-bearing:
// the API serves this file at GET /client with no script-src CSP, so nothing
// external can be fetched, and it must work from file:// with no network.
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  base: "./",
  build: {
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
  },
});
