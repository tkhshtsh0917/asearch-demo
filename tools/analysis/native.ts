/** Runs an explicit native Release CLI without loading Rust source in the demo. */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { root } from "./pins.ts";

export const nativeCLI =
  process.env.ASEARCH_ANALYZER_CLI ??
  fileURLToPath(
    new URL(
      `integration/.engine/release/asearch-cli${process.platform === "win32" ? ".exe" : ""}`,
      root,
    ),
  );

export function runNative(args: string[]): void {
  const result = spawnSync(nativeCLI, args, {
    maxBuffer: 1024 * 1024,
    timeout: 120_000,
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `Native analysis failed (requires asearch CLI with analyzer support): ${result.stderr?.toString() || result.error?.message}`,
      { cause: result.error },
    );
}
