import { defineConfig } from "vite";
export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  publicDir: "public/site",
  build: { target: "es2022" },
  worker: { format: "es" },
  optimizeDeps: { exclude: ["asearch-wasm"] },
  server: { host: "127.0.0.1" },
  preview: { host: "127.0.0.1" },
});
