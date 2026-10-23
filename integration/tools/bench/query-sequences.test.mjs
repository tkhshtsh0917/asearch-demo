import assert from "node:assert/strict";
import test from "node:test";
import { querySequences } from "./query-sequences.mjs";

test("seeded edit traces preserve Unicode symbols and replay deterministically", () => {
  const corpus = Array.from(
    { length: 100 },
    (_, i) => `${i}😀日本語の長い質問文をテストします`,
  );
  const first = querySequences(corpus);
  assert.deepEqual(first, querySequences(corpus));
  assert.notDeepEqual(first, querySequences(corpus, 67));
  assert.equal(first.length, 20);
  assert.ok(first.every((trace) => trace.at(-1) === "" && trace.length <= 16));
  assert.ok(
    first
      .slice(0, 16)
      .flat()
      .every((query) => !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(query)),
  );
});

test("invalid workloads fail before trace generation", () => {
  for (const corpus of [[], [1], ["x".repeat(65536)]])
    assert.throws(() => querySequences(corpus), RangeError);
  for (const seed of [-1, NaN, 2 ** 32])
    assert.throws(() => querySequences(["a"], seed), RangeError);
  assert.throws(() => querySequences(["a"], 31, 33), RangeError);
});
