/** Downloads bounded immutable artifacts and verifies cached bytes before reuse. */
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export const sha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
export type Pinned = { bytes: number; sha256: string; url: string };

async function collect(
  chunks: AsyncIterable<Uint8Array>,
  limit: number,
): Promise<Buffer> {
  const parts: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of chunks) {
    size += chunk.byteLength;
    if (size > limit) throw new Error("Pinned artifact byte limit");
    parts.push(chunk);
  }
  return Buffer.concat(parts);
}

export async function preparePinned(file: Pinned, path: string): Promise<void> {
  if (
    !Number.isSafeInteger(file.bytes) ||
    file.bytes < 1 ||
    file.bytes > 128 * 1024 * 1024 ||
    !/^https:\/\/huggingface\.co\//.test(file.url)
  )
    throw new Error("Invalid artifact pin");
  const cached = await collect(createReadStream(path), file.bytes).catch(
    () => undefined,
  );
  if (cached?.length === file.bytes && sha256(cached) === file.sha256) return;
  const response = await fetch(file.url, {
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok || !response.body)
    throw new Error("Pinned artifact fetch failed");
  const bytes = await collect(response.body, file.bytes);
  if (bytes.length !== file.bytes || sha256(bytes) !== file.sha256)
    throw new Error("Pinned artifact integrity mismatch");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(`${path}.partial`, bytes);
  await rename(`${path}.partial`, path);
}
