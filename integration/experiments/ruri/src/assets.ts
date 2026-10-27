/** Loads bounded, hash-verified model assets from this probe's own origin. */
export async function verifiedAsset(
  path: string,
  expectedBytes: number,
  expectedHash: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const response = await fetch(`/models/ruri/${path}`, {
    signal: AbortSignal.timeout(60_000),
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
  }
  if (offset !== expectedBytes) throw new Error(`Asset truncated: ${path}`);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const actual = Array.from(hash, (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
  if (actual !== expectedHash) throw new Error(`Asset hash mismatch: ${path}`);
  return bytes;
}
