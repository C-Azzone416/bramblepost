import { defineConfig, devices } from "@playwright/test";

/**
 * Real-browser phone pass: `npm run phone-pass`. Not part of `npm test` (vitest); runs in CI as the `phone-pass` job (#104).
 * Needs browsers once locally: `npx playwright install webkit chromium`.
 * In CI: list reporter only, and no trace, video or screenshot output, so nothing is uploaded or written beyond test names.
 * Device emulation only: WebKit for iPhone 13 size, Chromium for Pixel 7 size, touch on, portrait and landscape.
 */
const land = (d: (typeof devices)[string]) => ({ ...d, viewport: { width: d.viewport.height, height: d.viewport.width }, screen: { width: d.viewport.height, height: d.viewport.width } });

export default defineConfig({
  testDir: "tests/phone",
  testMatch: "*.spec.ts",
  outputDir: "test-results/phone-pass/artifacts",
  reporter: "list",
  retries: 0,
  timeout: 30_000,
  use: { baseURL: "http://127.0.0.1:4399/", trace: "off", video: "off", screenshot: "off" },
  webServer: {
    // Always the standard pack: the story pack and its path variable are removed from the build's environment, and a server
    // already on the port is never reused (the contrast spec also checks `data-pack` on the served page).
    command: "env -u BRAMBLEPOST_STORY_PACK VITE_STORY_PACK=standard sh -c 'npm run build && npx vite preview --port 4399 --strictPort --host 127.0.0.1'",
    url: "http://127.0.0.1:4399/",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: "iphone-portrait", use: { ...devices["iPhone 13"] } },
    { name: "iphone-landscape", use: land(devices["iPhone 13"]) },
    { name: "pixel-portrait", use: { ...devices["Pixel 7"] } },
    { name: "pixel-landscape", use: land(devices["Pixel 7"]) },
  ],
});
