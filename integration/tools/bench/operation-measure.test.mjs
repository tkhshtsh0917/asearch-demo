import assert from "node:assert/strict";
import test from "node:test";
import { measureComparison } from "./operation-measure.mjs";

function fixture({ id = 1, engine = "narrowing", failSession = false } = {}) {
  const events = [];
  const result = () => ({
    ids: [id],
    levels: [0],
    orders: [0],
    totals: [1],
    stats: { engine },
  });
  return {
    events,
    api: {
      AsearchIndex: {
        fromBytes(_bytes, options) {
          events.push(options?.expected ? "verified load" : "load");
          return {
            search: result,
            free: () => events.push("index free"),
            session() {
              if (failSession) throw new Error("session failed");
              return {
                reset() {},
                update: result,
                free: () => events.push("session free"),
              };
            },
          };
        },
      },
    },
  };
}

const options = { runs: 1, rounds: 2, warmup: 1 };
const bytes = new Uint8Array(48);

test("load retains zero samples, checks integrity descriptor and frees both sides", async () => {
  const a = fixture(),
    b = fixture();
  const result = await measureComparison(
    a.api,
    bytes,
    { ...options, candidateApi: b.api, kind: "load" },
    () => 0,
  );
  assert.equal(result.baseline.samples, 2);
  assert.equal(result.candidate.zeroSamples, 2);
  assert.equal(result.candidate.p95Ms, null);
  for (const { events } of [a, b]) {
    assert.equal(events.filter((v) => v === "verified load").length, 3);
    assert.equal(events.filter((v) => v === "index free").length, 3);
  }
});

test("load mismatch cannot produce evidence and releases the failed index", async () => {
  const a = fixture(),
    b = fixture({ id: 2 });
  await assert.rejects(
    measureComparison(a.api, bytes, {
      ...options,
      candidateApi: b.api,
      kind: "load",
    }),
    /mismatch/,
  );
  assert.equal(b.events.at(-1), "index free");
});

test("narrowing batches verify selection, preserve zeros and release all handles", async () => {
  const a = fixture(),
    b = fixture();
  const result = await measureComparison(
    a.api,
    bytes,
    {
      ...options,
      candidateApi: b.api,
      kind: "narrow-batch",
      primer: "a",
      pattern: "ab",
      iterations: 2,
    },
    () => 0,
  );
  assert.equal(result.baseline.zeroSamples, 2);
  for (const { events } of [a, b])
    assert.deepEqual(events.slice(-2), ["session free", "index free"]);
});

test("wrong engine and partial construction release indexes and sessions", async () => {
  for (const failure of [{ engine: "incremental" }, { failSession: true }]) {
    const a = fixture(),
      b = fixture(failure);
    await assert.rejects(
      measureComparison(a.api, bytes, {
        ...options,
        candidateApi: b.api,
        kind: "narrow-batch",
        primer: "a",
        pattern: "ab",
      }),
      /mismatch|failed/,
    );
    assert.deepEqual(a.events.slice(-2), ["session free", "index free"]);
    assert.equal(b.events.at(-1), "index free");
  }
});

test("invalid repetition counts and batch sizes are rejected", async () => {
  for (const invalid of [
    { runs: 0 },
    { rounds: Infinity },
    { iterations: 0 },
    { pattern: null },
  ]) {
    const a = fixture();
    await assert.rejects(
      measureComparison(a.api, bytes, {
        ...options,
        kind: "narrow-batch",
        primer: "a",
        pattern: "ab",
        ...invalid,
      }),
      RangeError,
    );
  }
});
