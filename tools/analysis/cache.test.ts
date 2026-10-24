import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { cached, digest, download } from "./cache.ts";

test("resource download bounds streams and cancels failed or excessive responses", async (t) => {
  let cancelled = false;
  const stream = () =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(4));
      },
      cancel() {
        cancelled = true;
      },
    });
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response(stream(), { status: 503 }),
  );
  await assert.rejects(
    download("https://example.test/source", 3),
    /request failed/,
  );
  assert.equal(cancelled, true);
  cancelled = false;
  t.mock.method(globalThis, "fetch", async () => new Response(stream()));
  await assert.rejects(
    download("https://example.test/source", 3),
    /byte limit/,
  );
  assert.equal(cancelled, true);
});

test("immutable cache reuse verifies bytes and never repairs corruption silently", async () => {
  const directory = await mkdtemp(join(tmpdir(), "asearch-resource-test-"));
  const target = pathToFileURL(join(directory, "source"));
  const bytes = Buffer.from("pinned source"),
    pin = { bytes: bytes.length, sha256: digest(bytes) };
  let calls = 0;
  const load = async () => {
    calls++;
    return bytes;
  };
  try {
    await cached(target, pin, load);
    await cached(target, pin, load);
    assert.equal(calls, 1);
    assert.deepEqual(await readFile(target), bytes);
    await writeFile(target, "corrupt");
    await assert.rejects(cached(target, pin, load), /digest mismatch/);
    assert.equal(calls, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
