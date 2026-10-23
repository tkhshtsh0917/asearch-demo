import { comparisonSettings } from "./search-settings.mjs";
import { timingSummary as summary } from "./timing-summary.mjs";
// Complete update calls, including JS/WASM transfers and result copies.
export const sequences = [
  ["地", "地理", "地理学", "地理", "地"],
  ["日", "日本", "日本の", "日本の歴", "日本の歴史"],
  ["使", "使い", "使い方", "使いか", "使い方"],
  ["ｶ", "ｶﾞ", "ｶﾞｸ", "ｶﾞ", "ｶ", ""],
];

function snapshot(result) {
  return JSON.stringify([
    ...["ids", "levels", "orders", "totals"].map((key) =>
      result[key] === undefined ? null : [...result[key]],
    ),
  ]);
}

export function measureSessions(
  api,
  bytes,
  {
    runs = 5,
    rounds = 50,
    warmup = 10,
    inputs = sequences,
    kind = "session",
    candidateApi = api,
    baselineEngine = "transposed-blocked",
    candidateEngine = "auto",
  } = {},
  now = () => performance.now(),
) {
  if (
    !["session", "search"].includes(kind) ||
    ![baselineEngine, candidateEngine].every((engine) =>
      ["auto", "transposed-blocked"].includes(engine),
    ) ||
    ![runs, rounds, warmup].every(
      (n) => Number.isInteger(n) && n > 0 && n <= 1000,
    ) ||
    !Array.isArray(inputs) ||
    inputs.length === 0 ||
    inputs.length > 64 ||
    inputs.some(
      (sequence) =>
        !Array.isArray(sequence) ||
        sequence.length === 0 ||
        sequence.length > 128 ||
        sequence.some(
          (query) => typeof query !== "string" || query.length > 65535,
        ),
    )
  )
    throw new RangeError("Invalid session benchmark workload");
  const index = api.AsearchIndex.fromBytes(bytes);
  let candidateIndex;
  let blocked;
  let candidate;
  try {
    candidateIndex =
      candidateApi === api ? index : candidateApi.AsearchIndex.fromBytes(bytes);
    const searchOptions = comparisonSettings({
      baselineEngine,
      candidateEngine,
    });
    const prepare = (index, settings) =>
      kind === "session"
        ? index.session(settings)
        : {
            reset() {},
            free() {},
            update(pattern) {
              return index.search(pattern, settings);
            },
          };
    blocked = prepare(index, searchOptions.baseline);
    candidate = prepare(candidateIndex, searchOptions.candidate);
    const expected = inputs.map((sequence) => {
      blocked.reset();
      return sequence.map((pattern) => snapshot(blocked.update(pattern)));
    });
    const engines = {};
    function execute(session, samples, countEngines) {
      for (let s = 0; s < inputs.length; s++) {
        session.reset();
        for (let q = 0; q < inputs[s].length; q++) {
          const begin = now();
          const result = session.update(inputs[s][q]);
          const elapsed = now() - begin;
          if (!Number.isFinite(elapsed) || elapsed < 0)
            throw new Error("Non-monotonic timer");
          if (samples) samples.push(elapsed);
          if (snapshot(result) !== expected[s][q])
            throw new Error("Session/full result mismatch");
          if (countEngines)
            engines[result.stats.engine] =
              (engines[result.stats.engine] ?? 0) + 1;
        }
      }
    }
    for (let i = 0; i < warmup; i++) {
      execute(blocked);
      execute(candidate);
    }
    const pairedRuns = [];
    for (let run = 0; run < runs; run++) {
      const baseline = [],
        optimized = [];
      for (let round = 0; round < rounds; round++) {
        if ((run + round) % 2 === 0) {
          execute(blocked, baseline);
          execute(candidate, optimized, true);
        } else {
          execute(candidate, optimized, true);
          execute(blocked, baseline);
        }
      }
      pairedRuns.push({ baseline, candidate: optimized });
    }
    return {
      category: `Individual ${kind === "session" ? "session.update" : "index.search"} latency, JS/WASM and copied results included; reset excluded`,
      correctness:
        "ids/levels/orders/exact totals checked outside each timing interval",
      kind,
      comparison: {
        baselineEngine,
        candidateEngine,
        separateArtifacts: candidateApi !== api,
      },
      searchOptions,
      inputs,
      runs,
      rounds,
      warmup,
      engines,
      pairedRuns,
      baseline: summary(pairedRuns.flatMap((run) => run.baseline)),
      candidate: summary(pairedRuns.flatMap((run) => run.candidate)),
      caveat:
        "Zero samples reflect timer quantization. These percentiles are observations, not rendering or device guarantees.",
    };
  } finally {
    candidate?.free();
    blocked?.free();
    if (candidateIndex && candidateIndex !== index) candidateIndex.free();
    index.free();
  }
}
