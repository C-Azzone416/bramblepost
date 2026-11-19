import { defineConfig } from "vitest/config";
import { contentPackPlugin } from "./vite-plugins/content-pack.ts";
import { localFeedbackPlugin } from "./vite-plugins/local-feedback.ts";

export default defineConfig(({ command, mode }) => {
  const feedbackMode = mode === "framebriar-local";
  const localFeedback = feedbackMode && command === "serve";
  return {
    // Relative asset paths, so the built game also works from a subfolder (e.g. GitHub Pages).
    base: "./",
    // Force safe placeholder content, including if this mode is accidentally passed to a build.
    plugins: [
      contentPackPlugin(feedbackMode ? { pack: "stand-in" } : {}),
      ...(localFeedback ? [localFeedbackPlugin(process.env.BRAMBLEPOST_FRAMEBRIAR_SDK_ROOT)] : []),
    ],
    ...(localFeedback ? {
      envDir: false as const,
      server: {
        host: "localhost",
        port: 8080,
        strictPort: true,
        cors: false as const,
        fs: {
          strict: true,
          deny: [".env", ".env.*", "*.{crt,pem,b64}", "**/.git/**", "**/.clubhouse/**",
            "**/.bramblepost/**", "**/secret-story/**", "**/content/story/**", "**/storyline*.md"],
        },
      },
    } : {}),
    test: {
      include: ["tests/**/*.test.ts"],
      testTimeout: 60_000,
    },
  };
});
