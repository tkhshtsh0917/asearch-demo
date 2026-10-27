import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { jsonAsset, segmentStream } from "../../src/worker/load.ts";

const base = new URL("https://example.test/data/");

test("metadata loading checks digest, byte limits and releases failed readers", async (t) => {
  const data = new TextEncoder().encode('{"ok":true}');
  t.mock.method(globalThis, "fetch", async () => new Response(data));
  const digest = createHash("sha256").update(data).digest("hex");
  assert.deepEqual(await jsonAsset(base, "catalog.json", 100, digest), {
    ok: true,
  });
  await assert.rejects(
    jsonAsset(base, "catalog.json", 100, "0".repeat(64)),
    /integrity/,
  );
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(data);
    },
    cancel() {
      cancelled = true;
    },
  });
  t.mock.method(globalThis, "fetch", async () => new Response(stream));
  await assert.rejects(jsonAsset(base, "catalog.json", 1), /byte limit/);
  assert.equal(cancelled, true);
  assert.equal(stream.locked, false);
  await assert.rejects(jsonAsset(base, "../private.json"), /filename/);
});

test("HTTP failures cancel unread segment bodies and fetches carry bounded deadlines", async (t) => {
  let cancelled = false,
    signal: AbortSignal | undefined | null;
  const stream = new ReadableStream<Uint8Array>({
    cancel() {
      cancelled = true;
    },
  });
  t.mock.method(
    globalThis,
    "fetch",
    async (_input: unknown, init?: RequestInit) => {
      signal = init?.signal;
      return new Response(stream, { status: 503 });
    },
  );
  await assert.rejects(segmentStream(base, "delta.asix"), /503/);
  assert.equal(cancelled, true);
  assert.ok(signal instanceof AbortSignal);
});

test("optional metadata fetches combine caller cancellation with their finite deadline", async (t) => {
  const signal = AbortSignal.abort();
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: unknown, options?: RequestInit) => {
      assert.equal(options?.signal?.aborted, true);
      throw new DOMException("cancelled", "AbortError");
    },
  );
  await assert.rejects(
    jsonAsset(
      new URL("https://example.test/"),
      "manifest.json",
      65536,
      undefined,
      signal,
    ),
    { name: "AbortError" },
  );
});

test("content-addressed metadata filenames reject stale bodies even without a separate full digest", async (t) => {
  const body = JSON.stringify({ value: "old" });
  t.mock.method(globalThis, "fetch", async () => new Response(body));
  await assert.rejects(
    jsonAsset(base, `manifest.${"0".repeat(20)}.json`),
    /integrity/,
  );
});
