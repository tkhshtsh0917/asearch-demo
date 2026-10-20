import { assetName } from "../shared/catalog.ts";
export async function jsonAsset(
  base: URL,
  name: string,
  max = 65536,
  sha256?: string,
): Promise<unknown> {
  const response = await fetch(new URL(assetName(name), base), {
    credentials: "omit",
    cache: "no-cache",
  });
  if (!response.ok || !response.body)
    throw new Error(`Asset unavailable (${response.status})`);
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
  if (sha256) {
    const hash = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    if (hash !== sha256) throw new Error("Catalog integrity mismatch");
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
export async function segmentStream(
  base: URL,
  name: string,
): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch(new URL(assetName(name), base), {
    credentials: "omit",
  });
  if (!response.ok || !response.body)
    throw new Error(`Segment unavailable (${response.status})`);
  return response.body;
}
