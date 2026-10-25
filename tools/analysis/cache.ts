/** Bounds and verifies language-resource transfers before atomic cache publication. */
import "../security/runtime.ts";
import { createHash, randomUUID } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";

export const digest = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");
export interface Pin {
  bytes: number;
  sha256: string;
}

export function verifyBytes(bytes: Uint8Array, pin: Pin): void {
  if (bytes.length !== pin.bytes || digest(bytes) !== pin.sha256)
    throw new Error("Analysis resource digest mismatch");
}

export async function download(url: string, limit: number): Promise<Buffer> {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok || !response.body) {
    void response.body?.cancel().catch(() => {});
    throw new Error(`Analysis resource request failed (${response.status})`);
  }
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) throw new Error("Analysis resource byte limit");
      chunks.push(value);
    }
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

/** Existing immutable files must still match; corruption never triggers silent replacement. */
export async function cached(
  target: URL,
  pin: Pin,
  load: () => Promise<Buffer>,
): Promise<void> {
  try {
    verifyBytes(await readFile(target), pin);
    return;
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !("code" in error) ||
      error.code !== "ENOENT"
    )
      throw error;
  }
  const bytes = await load();
  verifyBytes(bytes, pin);
  const temporary = new URL(`${target.href}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, bytes, { flag: "wx" });
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
}
