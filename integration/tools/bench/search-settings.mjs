// Pin public search semantics independently of each distribution's defaults.
export function searchSettings(engine = "auto", limit = 30, ranking) {
  if (!["auto", "transposed-blocked"].includes(engine))
    throw new RangeError("Invalid comparison engine");
  if (ranking !== undefined && !["stable", "position"].includes(ranking))
    throw new RangeError("Invalid comparison ranking");
  if (!Number.isInteger(limit) || limit < 0 || limit > 0xffffffff)
    throw new RangeError("Invalid comparison limit");
  return {
    ...(ranking === undefined ? {} : { ranking }),
    engine,
    mode: 2, // MatchMode.WildcardSpace on the public wire contract.
    wrap: true,
    maxAmbig: {
      kind: "by-length",
      every: 4,
      max: 3,
      unit: "profile",
      includeWildcards: false,
    },
    limit,
    countTotal: true,
  };
}

export function comparisonSettings(options, limit = options.limit ?? 30) {
  return {
    baseline: searchSettings(options.baselineEngine, limit, options.ranking),
    candidate: searchSettings(options.candidateEngine, limit, options.ranking),
  };
}
