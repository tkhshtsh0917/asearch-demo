import assert from "node:assert/strict";
import test from "node:test";
import { meanPool, normalize, prefixText } from "../src/policy.ts";

test("retrieval roles preserve original text and the required ASCII prefix space", () => {
  assert.equal(prefixText("びーt", "query"), "検索クエリ: びーt");
  assert.equal(prefixText("富士山", "document"), "検索文書: 富士山");
  assert.throws(() => prefixText("", "query"), /Empty/);
  assert.equal(prefixText("a".repeat(4096), "query").length, 4103);
  assert.throws(() => prefixText("a".repeat(4097), "query"), /byte limit/);
  assert.throws(() => prefixText("あ".repeat(1366), "query"), /byte limit/);
});

test("mean pooling excludes padding and normalizes the masked token sum", () => {
  const result = meanPool(new Float32Array([6, 0, 0, 8, 99, 99]), [1, 1, 0], 2);
  assert.ok(Math.abs((result[0] ?? 0) - 0.6) < 1e-7);
  assert.ok(Math.abs((result[1] ?? 0) - 0.8) < 1e-7);
  assert.throws(() => meanPool(new Float32Array([1, 2]), [0], 2), /Empty/);
  assert.throws(() => meanPool(new Float32Array([1, 2]), [2], 2), /mask/);
  assert.throws(() => meanPool(new Float32Array([1]), [1], 2), /shape/);
});

test("normalization rejects invalid vectors and retains tiny finite input", () => {
  assert.throws(() => normalize(new Float32Array([0, 0])), /Zero/);
  assert.throws(() => normalize(new Float32Array([NaN])), /Nonfinite/);
  assert.throws(() => normalize(new Float32Array([Infinity])), /Nonfinite/);
  assert.deepEqual(Array.from(normalize(new Float32Array([1e-40, 0]))), [1, 0]);
});
