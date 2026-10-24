/** Runs an explicit native Release CLI without loading Rust source in the demo. */
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
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

export type NativeRunner = (args: string[], binary: string) => void;

/** Copies already-captured bytes into a private executable used by this invocation. */
export function writeNative(directory: string, bytes: Uint8Array): string {
  const binary = join(
    directory,
    process.platform === "win32" ? "analyzer.exe" : "analyzer",
  );
  writeFileSync(binary, bytes, { flag: "wx", mode: 0o700 });
  return binary;
}

export function runNative(args: string[], binary = nativeCLI): void {
  const result = spawnSync(binary, args, {
    maxBuffer: 1024 * 1024,
    timeout: 120_000,
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `Native analysis failed (requires asearch CLI with analyzer support): ${result.stderr?.toString() || result.error?.message}`,
      { cause: result.error },
    );
}
