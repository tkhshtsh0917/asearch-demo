/** Adapts bounded, validated HTTP ranges to the Parquet reader interface. */
import "../security/runtime.ts";
import type { AsyncBuffer } from "hyparquet";

/** Reject servers ignoring Range instead of downloading a complete shard.
 * The transfer ceiling includes repeated/parallel reads, not just retained data. */
export function rangeFile(
  url: string,
  byteLength: number,
  fetcher: typeof fetch = fetch,
): AsyncBuffer {
  let requestedBytes = 0;
  return {
    byteLength,
    async slice(start, end = byteLength) {
      const size = end - start;
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start < 0 ||
        end > byteLength ||
        size <= 0 ||
        size > 16 * 1024 * 1024
      ) {
        throw new Error("Invalid or oversized Parquet byte range");
      }
      requestedBytes += size;
      if (requestedBytes > 64 * 1024 * 1024) {
        throw new Error("Parquet preparation exceeded 64 MiB transfer budget");
      }
      const response = await fetcher(url, {
        headers: {
          Range: `bytes=${start}-${end - 1}`,
          "Accept-Encoding": "identity",
        },
        signal: AbortSignal.timeout(30_000),
      });
      if (
        response.status !== 206 ||
        response.headers.get("content-range") !==
          `bytes ${start}-${end - 1}/${byteLength}` ||
        (response.headers.get("content-encoding") &&
          response.headers.get("content-encoding") !== "identity")
      ) {
        void response.body?.cancel().catch(() => {});
        throw new Error(
          "Server did not return the exact uncompressed byte range",
        );
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Missing range body");
      const result = new Uint8Array(size);
      let offset = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value.length > size - offset)
            throw new Error("Oversized range body");
          result.set(value, offset);
          offset += value.length;
        }
        if (offset !== size) throw new Error("Truncated range body");
        return result.buffer;
      } finally {
        void reader.cancel().catch(() => {});
        reader.releaseLock();
      }
    },
  };
}
