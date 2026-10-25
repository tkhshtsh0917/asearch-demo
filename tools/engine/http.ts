/** Reads an HTTP body within a byte ceiling and releases failed readers. */
import "../security/runtime.ts";

export async function readBody(
  response: Response,
  maxBytes: number,
  label: string,
): Promise<Buffer> {
  if (!response.ok || !response.body) {
    void response.body?.cancel().catch(() => {});
    throw new Error(`${label} request failed (${response.status})`);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > maxBytes) throw new Error(`${label} exceeds limit`);
      chunks.push(value);
    }

    return Buffer.concat(chunks);
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
