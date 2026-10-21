import { randomBytes } from "node:crypto";
import { defineConfig } from "vite";
export default defineConfig(({ command, isPreview }) => {
  // Vite injects CSS during development. Use one fresh server nonce rather
  // than weakening the static production policy with unsafe-inline.
  const nonce =
    command === "serve" && !isPreview
      ? randomBytes(16).toString("base64")
      : undefined;
  return {
    base: process.env.BASE_PATH ?? "/",
    publicDir: "public/site",
    ...(nonce
      ? {
          html: { cspNonce: nonce },
          plugins: [
            {
              name: "development-style-nonce",
              apply: "serve" as const,
              transformIndexHtml(html: string) {
                return html.replace(
                  "style-src 'self'",
                  `style-src 'self' 'nonce-${nonce}'`,
                );
              },
            },
          ],
        }
      : {}),
    build: { target: "es2022" },
    worker: { format: "es" },
    optimizeDeps: { exclude: ["asearch-wasm"] },
    server: { host: "127.0.0.1" },
    preview: { host: "127.0.0.1" },
  };
});
