import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { verifiedAsset } from "../src/assets.ts";

test("asset loading verifies complete bytes and digest without a Content-Length header", async (t) => {
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const digest = createHash("sha256").update(bytes).digest("hex");
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(bytes.slice(0, 2));
            controller.enqueue(bytes.slice(2));
            controller.close();
          },
        }),
      ),
  );

  assert.deepEqual(await verifiedAsset("fixture", 4, digest), bytes);
});

test("truncated, oversized and corrupted assets are rejected before model use", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch");
  fetch.mock.mockImplementation(
    async () => new Response(new Uint8Array([1, 2])),
  );
  await assert.rejects(
    verifiedAsset("fixture", 3, "0".repeat(64)),
    /truncated/,
  );

  fetch.mock.mockImplementation(
    async () => new Response(new Uint8Array([1, 2, 3, 4])),
  );
  await assert.rejects(
    verifiedAsset("fixture", 3, "0".repeat(64)),
    /size exceeded/,
  );

  fetch.mock.mockImplementation(
    async () => new Response(new Uint8Array([1, 2, 3])),
  );
  await assert.rejects(
    verifiedAsset("fixture", 3, "0".repeat(64)),
    /hash mismatch/,
  );
});
