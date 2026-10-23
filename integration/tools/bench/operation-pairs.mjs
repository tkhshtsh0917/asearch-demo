// Alternate matched operation samples and preserve whole runs.
import { timingSummary as summary } from "./timing-summary.mjs";

export function pairedOperations(
  execute,
  { runs = 5, rounds = 10, warmup = 3 },
) {
  if (
    ![
      [runs, 100],
      [rounds, 1000],
      [warmup, 100],
    ].every(([v, max]) => Number.isInteger(v) && v > 0 && v <= max)
  )
    throw new RangeError("Invalid operation repetitions");
  for (let i = 0; i < warmup; i++) {
    execute(0);
    execute(1);
  }
  const pairedRuns = [];
  for (let run = 0; run < runs; run++) {
    const pair = { baseline: [], candidate: [] };
    for (let round = 0; round < rounds; round++) {
      for (const side of (run + round) % 2 ? [1, 0] : [0, 1]) {
        const elapsed = execute(side);
        if (!Number.isFinite(elapsed) || elapsed < 0)
          throw new RangeError("Invalid operation timer");
        pair[side ? "candidate" : "baseline"].push(elapsed);
      }
    }
    pairedRuns.push(pair);
  }
  return {
    pairedRuns,
    baseline: summary(pairedRuns.flatMap((v) => v.baseline)),
    candidate: summary(pairedRuns.flatMap((v) => v.candidate)),
    options: { runs, rounds, warmup },
  };
}
