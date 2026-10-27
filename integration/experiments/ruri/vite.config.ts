import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { sourceIdentity } from "./tools/identity.ts";

export default defineConfig(async () => ({
  define: {
    __PROBE_SOURCE_ID__: JSON.stringify(
      await sourceIdentity(fileURLToPath(new URL(".", import.meta.url))),
    ),
  },
  worker: { format: "es" as const },
  build: { target: "es2024" },
}));
