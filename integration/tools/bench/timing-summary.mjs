// Retain coarse-clock zeros and suppress tails with too few observations.
export function timingSummary(raw) {
  if (!raw.length || raw.some((v) => !Number.isFinite(v) || v < 0))
    throw new RangeError("Expected nonnegative finite timing samples");
  const sorted = [...raw].sort((a, b) => a - b);
  const percentile = (q) => sorted[Math.floor((sorted.length - 1) * q)];
  return {
    samples: raw.length,
    zeroSamples: raw.filter((v) => v === 0).length,
    p50Ms: percentile(0.5),
    p95Ms: raw.length >= 100 ? percentile(0.95) : null,
    p99Ms: raw.length >= 1000 ? percentile(0.99) : null,
  };
}
