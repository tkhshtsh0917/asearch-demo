import assert from "node:assert/strict";
import test from "node:test";
import { workload } from "./workload.mjs";

test("Zipf workload has exact units, stable seeds and supported pattern lengths", () => {
  const data = workload(10000, 67);
  assert.deepEqual(data, workload(10000, 67));
  assert.notDeepEqual(data.texts, workload(10000, 31).texts);
  assert.equal(
    data.texts.reduce((sum, text) => sum + text.length, 0),
    10000,
  );
  assert.deepEqual(
    data.patterns.map((p) => p.length),
    [3, 7, 15, 31],
  );
  for (const text of data.texts) {
    assert.ok(text.length <= 60);
    for (const c of text)
      assert.ok(c.charCodeAt(0) >= 0x4e00 && c.charCodeAt(0) < 0x4e00 + 3000);
  }
});

test("workload rejects unsupported scale before generating data", () => {
  for (const units of [0, 9999, 10000001, Infinity, NaN, 10000.5])
    assert.throws(() => workload(units), RangeError);
});
