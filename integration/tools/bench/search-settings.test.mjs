import assert from "node:assert/strict";
import test from "node:test";
import { measureComparison } from "./operation-measure.mjs";

// Different artifact defaults can return identical hits on a small corpus.
function fixture(defaultLimit) {
  const calls = [];
  const result = () => ({
    length: 1,
    ids: [1],
    levels: [0],
    orders: [0],
    totals: [1],
    refs: [1],
    stats: { engine: "narrowing" },
  });
  const capture = (options) => {
    calls.push({ limit: defaultLimit, mode: 0, wrap: false, ...options });
    return result();
  };
  return {
    calls,
    api: {
      AsearchIndex: {
        fromBytes() {
          return {
            search(_pattern, options) {
              return capture(options);
            },
            session(options) {
              capture(options);
              return {
                reset() {},
                free() {},
                update: result,
              };
            },
            explain(_ref, _pattern, options) {
              capture(options);
              return { text: "ab", level: 0, spans: [[0, 2]] };
            },
            free() {},
          };
        },
      },
    },
  };
}

for (const kind of ["session", "search", "load", "narrow-batch", "explain"]) {
  test(`${kind} applies and records identical explicit semantics despite different defaults`, async () => {
    const baseline = fixture(1),
      candidate = fixture(100);
    const report = await measureComparison(
      baseline.api,
      new Uint8Array(48),
      {
        candidateApi: candidate.api,
        baselineEngine: "auto",
        candidateEngine: "auto",
        kind,
        runs: 1,
        rounds: 1,
        warmup: 1,
        iterations: 1,
        inputs: [["ab"]],
        primer: "a",
        pattern: "ab",
        count: 5,
      },
      () => 0,
    );
    const expected = {
      engine: "auto",
      mode: 2,
      wrap: true,
      limit: kind === "explain" ? 5 : 30,
      countTotal: true,
      maxAmbig: {
        kind: "by-length",
        every: 4,
        max: 3,
        unit: "profile",
        includeWildcards: false,
      },
    };
    assert.deepEqual(report.searchOptions, {
      baseline: expected,
      candidate: expected,
    });
    for (const fixture of [baseline, candidate]) {
      assert.ok(fixture.calls.length > 0);
      for (const received of fixture.calls)
        assert.deepEqual(received, expected);
    }
  });
}
