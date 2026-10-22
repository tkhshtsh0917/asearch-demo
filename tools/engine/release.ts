import { createHash } from "node:crypto";
import {
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unpackRelease } from "./archive.ts";
import { readBody } from "./http.ts";

/** Accepts versioned Release tags without paths or control characters. */
export function isReleaseTag(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(
      value,
    )
  );
}

export function releasePin(value: unknown, platform: string) {
  const pin = value as {
    repository?: unknown;
    tag?: unknown;
    assets?: Record<string, unknown>;
  };
  if (
    !pin ||
    typeof pin.repository !== "string" ||
    !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(pin.repository) ||
    !isReleaseTag(pin.tag)
  )
    throw new Error("Invalid release identity");
  const sha256 = pin.assets?.[platform];
  if (typeof sha256 !== "string" || !/^[a-f0-9]{64}$/.test(sha256))
    throw new Error(
      `Release checksum is not configured for ${platform}; pin a published asset first`,
    );
  return {
    repository: pin.repository,
    tag: pin.tag,
    sha256,
    archive: `asearch-assets-${platform}.tar.gz`,
  };
}

/** Verifies a pinned bundle before replacing the prepared CLI, WASM and notices. */
export async function prepareRelease(
  root: URL,
  localDirectory?: string,
): Promise<void> {
  const platform = `${process.platform === "darwin" ? "macos" : process.platform === "win32" ? "windows" : process.platform}-${process.arch === "arm64" ? "aarch64" : process.arch === "x64" ? "x86_64" : process.arch}`;
  const pin = releasePin(
    JSON.parse(await readFile(new URL("release.lock.json", root), "utf8")),
    platform,
  );

  let bytes: Uint8Array;
  if (localDirectory) {
    const path = join(localDirectory, pin.archive);
    if ((await stat(path)).size > 64 * 1024 * 1024)
      throw new Error("Release asset exceeds 64 MiB");
    bytes = await readFile(path);
  } else {
    const response = await fetch(
      `${pin.repository}/releases/download/${pin.tag}/${pin.archive}`,
      { signal: AbortSignal.timeout(120_000) },
    );
    bytes = await readBody(response, 64 * 1024 * 1024, "Release asset");
  }
  if (
    bytes.length > 64 * 1024 * 1024 ||
    createHash("sha256").update(bytes).digest("hex") !== pin.sha256
  )
    throw new Error("Release asset SHA-256 mismatch");

  const temporary = await mkdtemp(join(tmpdir(), "asearch-release-"));
  try {
    const archive = join(temporary, "asset.tgz");
    await writeFile(archive, bytes);
    const { unpack, cli } = await unpackRelease(archive, temporary);

    const destination = new URL("integration/.engine/release/", root);

    await rm(destination, { recursive: true, force: true });
    await mkdir(destination, { recursive: true });
    await cp(unpack, destination, { recursive: true });
    if (process.platform !== "win32")
      await chmod(new URL(cli, destination), 0o755);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
