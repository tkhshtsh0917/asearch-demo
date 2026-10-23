// Compare explanations of equivalent ranked results without comparing opaque refs.
import { pairedOperations } from "./operation-pairs.mjs";

export function measureExplanations(apis, bytes, options, now) {
  const { pattern = "日本", count = 20, iterations = 32 } = options;
  if (
    typeof pattern !== "string" ||
    ![1, 5, 20].includes(count) ||
    !Number.isInteger(iterations) ||
    iterations < 1 ||
    iterations > 1024
  )
    throw new RangeError("Invalid explanation workload");
  const indexes = [];
  const searchOptions = { countTotal: true, limit: count };
  try {
    for (const api of apis) indexes.push(api.AsearchIndex.fromBytes(bytes));
    const results = indexes.map((index) =>
      index.search(pattern, searchOptions),
    );
    const snapshot = (r) =>
      JSON.stringify([r.ids, r.levels, r.orders, r.totals].map((v) => [...v]));
    if (snapshot(results[0]) !== snapshot(results[1]) || !results[0].length)
      throw new Error("Explanation search mismatch or empty workload");
    const explain = (side) =>
      [...results[side].refs].map((ref) =>
        indexes[side].explain(ref, pattern, searchOptions),
      );
    const reference = JSON.stringify(explain(0));
    const verify = (value) => {
      if (JSON.stringify(value) !== reference || value.some((v) => v === null))
        throw new Error("Explanation mismatch");
    };
    verify(explain(1));
    const report = pairedOperations((side) => {
      let last;
      const start = now();
      for (let i = 0; i < iterations; i++) last = explain(side);
      const elapsed = (now() - start) / iterations;
      verify(last);
      return elapsed;
    }, options);
    return {
      ...report,
      pattern,
      count: results[0].length,
      iterations,
      scope:
        "Batch mean ms per ranked explanation group using public explain; includes original-coordinate spans/text/result copies, excludes search and index construction. Not individual keystroke percentiles.",
    };
  } finally {
    for (const index of indexes.reverse()) index.free();
  }
}
