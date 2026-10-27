/** Loads bounded, hash-verified model assets from this probe's own origin. */
import { cachedBlob, saveBlob } from "./cache.ts";

export const assetStats = { cacheHits: 0, fetchedDecodedBytes: 0 };

async function matches(bytes: Uint8Array<ArrayBuffer>, expectedHash: string) {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return (
    Array.from(hash, (value) => value.toString(16).padStart(2, "0")).join(
      "",
    ) === expectedHash
  );
}

export async function verifiedAsset(
  path: string,
  expectedBytes: number,
  expectedHash: string,
  base = "/models/ruri/",
): Promise<Uint8Array<ArrayBuffer>> {
  const cached = await cachedBlob(expectedHash, expectedBytes);
  if (cached) {
    const bytes = new Uint8Array(await cached.arrayBuffer());
    if (await matches(bytes, expectedHash)) {
      assetStats.cacheHits++;
      return bytes;
    }
  }
  const response = await fetch(`${base}${path}`, {
    signal: AbortSignal.timeout(60_000),
    redirect: "error",
  });
  if (!response.ok || !response.body)
    throw new Error(`Asset unavailable: ${path}`);

  const bytes = new Uint8Array(expectedBytes);
  let offset = 0;
  for await (const chunk of response.body) {
    if (offset + chunk.byteLength > expectedBytes)
      throw new Error(`Asset size exceeded: ${path}`);
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
    assetStats.fetchedDecodedBytes += chunk.byteLength;
  }
  if (offset !== expectedBytes) throw new Error(`Asset truncated: ${path}`);
  if (!(await matches(bytes, expectedHash)))
    throw new Error(`Asset hash mismatch: ${path}`);
  await saveBlob(expectedHash, bytes);
  return bytes;
}
