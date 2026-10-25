# Validation and measurement

[日本語](../ja/spec/validation.md)

<a id="section-14"></a>

## 14. Correctness coverage

Use hashed upstream fixtures and independent cost-matrix/alignment models, not only another copy of the optimized implementation. Cover empty/space inputs, length boundaries, normalization, casing, surrogate pairs/lone units, all supported modes/profiles/K, corrupt ASIX, overflow, small budgets, streams, disposal, callbacks/getters, updates and deterministic bytes.

Native allocation counters verify prepared matching without heap allocation. This excludes JS/WASM transport, copied results, updates and first-search setup. Format and intent fuzzing are finite robustness checks, not proofs. Browser tests run actual read-only WASM; native CLI fixture creation remains outside runtime and timing intervals. OSA and other unimplemented engines are not claimed as tested product features.

<a id="section-14-1"></a>

### 14.1 Coverage areas

Cover these public boundaries when changing the corresponding behavior:

- Source/lib fixtures, upstream assertions, README examples, deliberate deviations, public types and native compatibility allocation checks.
- Initialization attempts, concurrent init, old ready promises, retry/failure, Node ESM/CJS, Worker and independent packed distribution.
- Equivalent-result AB/BA comparison, synthetic noise/regression classification and reproducible aggregation.
- K boundaries, wrap/normalization/spaces/non-BMP, zero limit, empty input, strict options, distinct-key ranking and totals.
- Small byte/text/slot/working limits, overflow, long/empty texts, failed readers and staging cleanup.
- Determinism, server fixture bytes, critical/noncritical sections, reservations/checksums/layout and format fuzz.
- Normalized prefix changes, backspace, K growth, mode changes, outside-top-N candidates, eviction/fallback and dense equivalence.
- Old-state search during staging, BUSY, free/cancel, failed-state retention, sessions, segments and budget bounds.
- Series/config/generation conflicts, stale updates, SRI, none-generation advancement and atomic manifest retry.
- Original UTF-16 mapping, kana/marks/width, deterministic ties and copied/stale/foreign refs.
- DAG versus small full expansion, exponential choices, bounded grammar/depth/nodes and best expansion.
- Record optional-engine decisions; adopted kernels require equivalence, capability/fallback, safety and controlled benefit.

New query rules add whole-term/negative/ambiguous behavior, literal-plus-alternative ranking, deduplication and count bounds, mixed composition, shared publication snapshots and bounds. Position ranking adds independent substring oracles, global-before-limit aliases, copied starts, shard modes, updates and transition-budget recovery. Demo tests cover initial/delta/compact/restore/restart, labels and mobile layouts. Query waits correlate a new request with its accepted DOM mutation; withheld responses, held render frames, superseded requests and abandoned Workers are regression cases, including identical repeated input.

<a id="section-15"></a>

## 15. Performance methodology

<a id="section-15-1"></a>

### 15.1 Workload and metrics

Use fixed real/synthetic corpora, Japanese/ASCII/non-BMP/wildcard cases, typo queries and IME-like replacement sequences. Measure matching, first readiness, load/update, server building, linear memory and transfer/WASM sizes separately. One-shot boolean matching, full-corpus minimum-level top-N, sessions and lifecycle operations are different workloads. A result/semantic mismatch invalidates a speed-ratio claim.

<a id="section-15-1-1"></a>

### 15.1.1 Paired regression decisions

- Fix profile, normalizer, mode/wrap, K, limit, countTotal, ranking, corpus, seed and request sequence. Check results before timing. Record compared implementation commits and harness commit.
- Alternate baseline/candidate AB/BA on the same host/browser. Use at least five independent paired runs with equivalent warmup/cache state. Reset sessions at declared boundaries. Do not run builds/tests/other benchmarks concurrently.
- Each run needs at least 30 post-warmup samples. Individual keystroke p95 claims need at least 100 keystrokes per configuration; p99 needs 1,000. These counts do not guarantee statistical precision. Batched-operation distributions are batch means, not individual-keystroke percentiles.
- Aggregate candidate/baseline median ratios with a geometric mean and fixed-seed, 10,000-resample paired bootstrap 95% interval. Only a lower bound above 1.10 is a regression candidate. Repeat an independent five-pair group; confirm only if both groups meet the rule. Otherwise report uncertainty and do not select convenient runs.
- Shared CI requires correctness/types/format/lint/builds, not noisy speed thresholds. Controlled release measurements may gate performance decisions; a dedicated runner must use the same rules.
- Preserve raw samples, seeds, workload hashes, source/harness commits, dependencies, browser/compiler, OS/CPU, timer and aggregation code. Distinguish WASM linear memory, Rust capacity budgets and JS/process memory. Mark uncollected metrics explicitly.

<a id="section-15-2"></a>

### 15.2 Interpretation

Do not use proxy prototypes or old corpus shapes as product guarantees. Include extraction, transport, load and updates rather than only DP rows. Position ranking intentionally changes ordering and adds work, so its overhead must be labeled separately from equivalent-result optimization comparisons. See [benchmark procedures](../../tools/bench/README.md) and [performance decisions](../performance.md).

The fixture generator uses pinned esbuild to transpile the upstream TypeScript oracle; it does not depend on the TypeScript compiler JavaScript API. Regeneration must keep the checked-in compatibility fixture bytes unchanged. Project type checking continues to use TypeScript 7.
