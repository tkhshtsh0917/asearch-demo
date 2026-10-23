# Comparing session performance

[日本語](ja/performance.md)

Compare two explicitly prepared distributions with the same ASIX input and engine:

```sh
node tools/bench/compare-session.mjs BASELINE_DIST CANDIDATE_DIST INPUT_ASIX OUTPUT_JSON BASELINE_COMMIT CANDIDATE_COMMIT auto node
```

Run from the integration workspace. Distribution directories contain `node.mjs` and the generated `node/` bindings and WASM. Commit arguments are full 40-character source commit IDs; callers must verify their correspondence to the supplied artifacts. Use `transposed-blocked` instead of `auto` to isolate full-search changes. Build and prepare fixtures before measuring; do not run tests or builds concurrently.

The runner preserves five paired runs, alternates AB/BA order, resets each input sequence and checks ids, levels, orders and exact totals outside each update's timing interval. It measures the public API including JS/WASM transfers and result copies, excluding loading, reset, network and rendering. Distinct distributions own separate indexes and sessions. The report records artifact, corpus and harness hashes, source labels, runtime information and raw individual samples. Paths are not written to the report.

Timer zeros are retained. Percentiles below the clock's useful resolution are inconclusive. This runner reports observations, not an automatic adoption decision: confirm improvements in an independent measurement group and inspect median and tail regressions. The built-in short input sequences are regression workloads, not representative coverage of all queries. The existing `session.mjs` compares blocked and auto within one distribution; it answers a different question.

Use `browser` instead of `node` as the final argument to run Chromium, Firefox and WebKit sequentially. Both browser distributions are served at separate loopback module URLs; only the selected web entry point, generated glue and WASM filenames are exposed. The fetched ASIX digest is checked before measuring.

The optional final `WORKLOAD_JSON` argument accepts `inputs` (arrays of query strings), `kind` (`session` or `search`), `runs`, `rounds` and `warmup`. Both versions receive the same options. `kind: "search"` measures independent index.search calls without session caching. Workload files are bounded to 1 MiB and their hash is recorded. `querySequences(texts, seed, count)` from `tools/bench/query-sequences.mjs` creates deterministic prefix, deletion, replacement and reset traces plus Unicode/wildcard cases. Use different frozen seeds for tuning and confirmation; record the corpus identity separately. Repeated traces do not constitute independent query coverage.

Regression tests also force real narrowing through 31/32 and 63/64/65 literal positions in Node ESM/CJS and all three browser engines. They compare ids, minimum levels, order and exact totals against full search, covering the scalar kernel and its long-pattern fallback.

## Applied settings and records

Every comparison passes explicit `mode: 2` (WildcardSpace), `wrap: true`, `countTotal: true`, `limit: 30` and `maxAmbig: { kind: "by-length", every: 4, max: 3, unit: "profile", includeWildcards: false }`. Explanation comparisons set `limit` to the requested `count` instead. Both sides receive the selected engine explicitly, including `auto`; no artifact's search defaults determine the workload. Load validation searches and explanation setup use the same pinned settings outside their timed sections.

`searchOptions.baseline` and `searchOptions.candidate` record the very settings passed to the public APIs, replacing the session runner's former descriptive `options` field. Load/batch `options` still records repetition counts; `iterations` records each batch size. The settings helper is included in harness hashes. Different engine names intentionally compare execution strategies; version comparisons should use the same engine. If a version does not support the pinned settings, the run must fail rather than silently fall back.

The retained tuning measurements used distributions with these same defaults. Their reported benefits remain conditional historical observations; the corrected runner makes those conditions explicit for future comparisons. A validation run with identical artifacts checks the harness, not the speedup of a code change.

## Load and short-operation comparisons

The same runner accepts `kind: "load"` to time in-memory `fromBytes` including expected SHA-384 verification. It builds the descriptor from the supplied ASIX, then checks search results and frees each index outside the timer. This measures validation and derived-structure construction, excluding module initialization, HTTP transfer and rendering. For example:

```json
{ "kind": "load", "runs": 5, "rounds": 10, "warmup": 3 }
```

For operations shorter than browser clock resolution, `kind: "narrow-batch"` measures repeated public session updates after an untimed reset and prime. Supply `primer`, `pattern` and `iterations` (default 512). The first target result after priming and the final result must agree across versions and select the narrowing engine; an unsuitable corpus or K-policy transition fails the measurement. This deliberately measures a warmed repeated query, not a typing trace. Report its samples as **batch mean milliseconds per update**, never individual keystroke percentiles.

All operation modes retain zero samples, raw paired runs and AB/BA order. Load/batch summaries omit p95 below 100 samples and p99 below 1,000. Bootstrap whole paired runs with `pairedInterval` from `statistics.mjs` only when their medians are positive. Repeat in an independent process; do not infer tail confidence from a small number of batches. Artifact hashes identify the measured bytes; source commit labels alone do not prove provenance.

All session and segment summaries also suppress p95 below 100 observations and p99 below 1,000. These minimum counts do not guarantee tail precision; inspect whole-run variation and timer zeros.

`kind: "explain"` accepts `pattern`, `count` (1, 5 or 20) and `iterations` (default 32). Both indexes first search with the same options, and their ids/levels/orders/exact totals must agree. Each version uses its own opaque refs. The timed batch calls public `explain` for that ranked group, including text/span construction and result copying; search and index setup are excluded. Text, coordinates, level and spans must match outside timing. Samples are batch means per explanation group, not individual queries. A pattern with no hits fails instead of measuring an empty loop.

`pairedInterval(runs, seed, q)` also supports run-level quantiles such as `q=0.95`. Its estimate is the geometric mean of paired run-quantile ratios, with whole runs resampled together; it is not a bootstrap of independent keystrokes or a confidence interval for a pooled percentile. Use enough observations **within each run** for the requested tail, preserve clock limitations, and confirm in a second group.

For synthetic scaling, `node tools/bench/corpus.mjs UNITS UINT32_SEED DOCS_JSONL WORKLOAD_JSON` emits a deterministic Zipf corpus (3,000 BMP symbols, exponent 1.05, 10–60-unit texts) and seeded edit traces. UNITS is 10,000–10,000,000. Output files must not exist. Build ASIX separately with the prepared CLI's `build DOCS_JSONL NEW_INDEX_ASIX`, then pass that ASIX and workload to the comparison runner. Do not generate corpora or run the CLI inside search timing. This is an algorithmic stress workload, not a relevance benchmark. Hash the generated ASIX and retain the generator/seed/toolchain identity.

Paired intervals keep zero observations in the sorted run samples. A ratio is available only if the **selected quantile of every run on both sides** is positive; otherwise it fails as below timing resolution. Positive quantiles alone do not remove clock quantization uncertainty. The older fixed-level `quantile` helper still requires positive calibrated batch samples.

`narrow-batch` requires `auto` on both sides. Forced blocked or unknown engines are rejected before constructing indexes; sessions explicitly receive `engine: "auto"`, and the report records both applied engine settings. Use `kind: "search"` for a forced full-search comparison.
