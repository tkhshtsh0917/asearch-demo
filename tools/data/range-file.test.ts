import assert from "node:assert/strict";
import test from "node:test";
import { rangeFile } from "./range-file.ts";

const url = "https://example.test/data.parquet";

test("range fetch validates exact ranges and reads only the requested bytes", async () => {
  const file = rangeFile(url, 100, async (_url, init) => {
    assert.equal(new Headers(init?.headers).get("range"), "bytes=4-7");
    return new Response(new Uint8Array([1, 2, 3, 4]), {
      status: 206,
      headers: { "Content-Range": "bytes 4-7/100" },
    });
  });
  assert.deepEqual(
    new Uint8Array(await file.slice(4, 8)),
    new Uint8Array([1, 2, 3, 4]),
  );
});

test("full responses, wrong offsets, truncation and overflow are rejected", async () => {
  for (const [status, range, body] of [
    [200, "bytes 4-7/100", [1, 2, 3, 4]],
    [206, "bytes 5-8/100", [1, 2, 3, 4]],
    [206, "bytes 4-7/100", [1, 2]],
    [206, "bytes 4-7/100", [1, 2, 3, 4, 5]],
  ] as const) {
    const file = rangeFile(
      url,
      100,
      async () =>
        new Response(new Uint8Array(body), {
          status,
          headers: { "Content-Range": range },
        }),
    );
    await assert.rejects(async () => file.slice(4, 8));
  }
  const file = rangeFile(url, 100, async () => {
    throw new Error("must not fetch");
  });
  for (const [start, end] of [
    [-1, 4],
    [0, 101],
    [2, 2],
    [1.5, 4],
  ])
    await assert.rejects(async () => file.slice(start as number, end));
});
