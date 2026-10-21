import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { prepareRelease } from "./release.ts";

const root = new URL("../../", import.meta.url);
await prepareRelease(root, process.argv[2]);
function run(command: string, args: string[], cwd: URL): void {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    env: {
      ...process.env,
      npm_config_cache: fileURLToPath(
        new URL("integration/.engine/npm-cache", root),
      ),
    },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed`);
}
run("pnpm", ["build"], new URL("integration/", root));
await mkdir(new URL("vendor/", root), { recursive: true });
run(
  "npm",
  [
    "pack",
    "--workspace",
    "packages/asearch-wasm",
    "--ignore-scripts",
    "--pack-destination",
    "../vendor",
  ],
  new URL("integration/", root),
);
