/** Fetches bounded same-origin metadata and segment assets with digest checks. */
import { assetName } from "../shared/catalog.ts";

export async function jsonAsset(
  base: URL,
  name: string,
  max = 65536,
  sha256?: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await fetch(new URL(assetName(name), base), {
    credentials: "omit",
    cache: "no-cache",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
      : AbortSignal.timeout(30000),
  });
  if (!response.ok || !response.body) {
    void response.body?.cancel().catch(() => {});
    throw new Error(`Asset unavailable (${response.status})`);
  }
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = [];
  let total = 0,
    complete = false;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) {
        complete = true;
        break;
      }
      total += value.length;
      if (total > max) throw new Error("Asset exceeds byte limit");
      chunks.push(value);
    }
  } finally {
    if (!complete) void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const contentName = /\.([a-f0-9]{20})\.json$/.exec(name)?.[1];
  if (sha256 || contentName) {
    const hash = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    if (
      (sha256 && hash !== sha256) ||
      (contentName && !hash.startsWith(contentName))
    )
      throw new Error("Asset integrity mismatch");
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

export async function segmentStream(
  base: URL,
  name: string,
): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch(new URL(assetName(name), base), {
    credentials: "omit",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok || !response.body) {
    void response.body?.cancel().catch(() => {});
    throw new Error(`Segment unavailable (${response.status})`);
  }
  return response.body;
}
