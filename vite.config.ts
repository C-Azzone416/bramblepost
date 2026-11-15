import { defineConfig } from "vitest/config";
import { contentPackPlugin } from "./vite-plugins/content-pack.ts";

export default defineConfig({
  // Relative asset paths, so the built game also works from a subfolder (e.g. GitHub Pages).
  base: "./",
  plugins: [contentPackPlugin()],
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 60_000,
  },
});
