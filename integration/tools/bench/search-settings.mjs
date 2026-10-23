// Pin public search semantics independently of each distribution's defaults.
export function searchSettings(engine = "auto", limit = 30) {
  if (!["auto", "transposed-blocked"].includes(engine))
    throw new RangeError("Invalid comparison engine");
  return {
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

export function comparisonSettings(options, limit = 30) {
  return {
    baseline: searchSettings(options.baselineEngine, limit),
    candidate: searchSettings(options.candidateEngine, limit),
  };
}
