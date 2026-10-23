import assert from "node:assert/strict";
import test from "node:test";
import { timingSummary } from "./timing-summary.mjs";

test("tails require minimum observation counts without dropping zeros", () => {
  for (const count of [1, 99, 100, 999, 1000]) {
    const result = timingSummary(Array(count).fill(0));
    assert.equal(result.zeroSamples, count);
    assert.equal(result.p50Ms, 0);
    assert.equal(result.p95Ms, count >= 100 ? 0 : null);
    assert.equal(result.p99Ms, count >= 1000 ? 0 : null);
  }
});

test("summary does not mutate samples or accept invalid timer readings", () => {
  const raw = [3, 0, 1];
  assert.equal(timingSummary(raw).p50Ms, 1);
  assert.deepEqual(raw, [3, 0, 1]);
  for (const values of [[], [-1], [Infinity], [NaN]])
    assert.throws(() => timingSummary(values), RangeError);
});
