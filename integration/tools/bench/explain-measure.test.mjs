import assert from "node:assert/strict";
import test from "node:test";
import { measureComparison } from "./operation-measure.mjs";

function fixture(ref, text = "日本") {
  const released = [];
  return {
    released,
    api: {
      AsearchIndex: {
        fromBytes() {
          return {
            search: () => ({
              length: 1,
              ids: [1],
              levels: [0],
              orders: [0],
              totals: [1],
              refs: [ref],
            }),
            explain(value) {
              assert.equal(value, ref);
              return { text, spans: [[0, 2]], level: 0 };
            },
            free: () => released.push(ref),
          };
        },
      },
    },
  };
}

const options = {
  kind: "explain",
  runs: 1,
  rounds: 2,
  warmup: 1,
  iterations: 2,
};

test("explanation comparison uses per-instance refs and retains timer zeros", async () => {
  const a = fixture(3),
    b = fixture(17);
  const result = await measureComparison(
    a.api,
    new Uint8Array(),
    { ...options, candidateApi: b.api },
    () => 0,
  );
  assert.equal(result.count, 1);
  assert.equal(result.baseline.zeroSamples, 2);
  assert.equal(result.candidate.p95Ms, null);
  assert.deepEqual(a.released, [3]);
  assert.deepEqual(b.released, [17]);
});

test("explanation mismatch invalidates evidence and releases both indexes", async () => {
  const a = fixture(3),
    b = fixture(17, "different");
  await assert.rejects(
    measureComparison(a.api, new Uint8Array(), {
      ...options,
      candidateApi: b.api,
    }),
    /mismatch/,
  );
  assert.deepEqual(a.released, [3]);
  assert.deepEqual(b.released, [17]);
  await assert.rejects(
    measureComparison(a.api, new Uint8Array(), { ...options, count: 0 }),
    RangeError,
  );
});
