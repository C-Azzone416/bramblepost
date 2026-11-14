import { defineConfig } from "vitest/config";

export default defineConfig({
  // Relative asset paths, so the built game also works from a subfolder (e.g. GitHub Pages).
  base: "./",
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 60_000,
  },
});
