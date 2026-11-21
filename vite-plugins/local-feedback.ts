import path from "node:path";
import { build } from "esbuild";
import type { Plugin } from "vite";

const ID = "virtual:local-feedback-sdk";
const RESOLVED = "\0" + ID;

/** Never add the private checkout to Vite's filesystem allowlist. Bundle only the offline entry point. */
export function localFeedbackPlugin(sdkRoot: string | undefined): Plugin {
  return {
    name: "bramblepost-local-feedback",
    apply: "serve",
    configResolved(config) {
      const { host, port, strictPort } = config.server;
      if (config.mode !== "framebriar-local" || host !== "localhost" || port !== 8080 || !strictPort ||
          config.server.cors !== false || config.server.fs.strict !== true)
        throw Error("Local feedback requires the dedicated localhost:8080 server.");
    },
    transformIndexHtml(html) {
      // This deliberately uses system fonts rather than contacting a third party.
      return html.replace(/<link\b[^>]*https:\/\/fonts\.(?:googleapis|gstatic)\.com[^>]*>/g, "");
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const origin = request.headers.origin;
        if (request.headers.host !== "localhost:8080" || (origin && origin !== "http://localhost:8080")) {
          response.writeHead(403).end();
          return;
        }
        let pathname: string;
        try {
          pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost:8080").pathname);
        } catch {
          response.writeHead(400).end();
          return;
        }
        if (/(?:^|\/)\.env(?:[./]|$)/i.test(pathname)) {
          response.writeHead(403).end();
          return;
        }
        response.setHeader("Content-Security-Policy", "default-src 'self'; connect-src 'self' ws://localhost:8080; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
        next();
      });
    },
    resolveId(id) {
      if (id === ID) return RESOLVED;
    },
    async load(id) {
      if (id !== RESOLVED) return;
      if (!sdkRoot) return "export const prepareLocalFeedback = undefined;";
      const result = await build({
        entryPoints: [path.resolve(sdkRoot, "adapters/browser/local-export.mjs")],
        bundle: true,
        platform: "browser",
        format: "esm",
        write: false,
        sourcemap: false,
        logLevel: "silent",
      });
      return result.outputFiles[0].text;
    },
  };
}
