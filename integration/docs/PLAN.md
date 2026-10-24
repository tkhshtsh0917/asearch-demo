# Milestones and acceptance gates

[日本語](ja/PLAN.md)

## Goal

Provide a small Rust matching/CLI/WASM repository and a separate TS/browser integration and demo repository. Server-built base/delta indexes are delivered through immutable assets; the browser searches and adopts them. There is no browser edit overlay or npm publication.

## Completed milestone sequence

M0–M7 reached local acceptance on 2026-10-21. These are development milestones, not claims about today's hosted deployment or universal performance.

| Milestone | Delivered scope                                                                                   | Required evidence                                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| M0        | Compatibility core, thin WASM boundary, JS compilation, initialization, types, fixtures, notices  | Both profiles, upstream fixtures/examples, type shape, allocation checks, packed distribution, browser/Worker and init retry |
| M1        | matchLevel, disposal, generic ScalarWm/workspaces, corpus engine, CLI verification/bench          | Equivalent results, separate JS/boundary/kernel timing, paired AB/BA and reproducible aggregation                            |
| M2        | Bulk ASIX, blocked transposed engine, normalization, ambiguity policy, top-N/totals and streaming | Independent oracle, deterministic bytes, corrupt-input/resource tests, format fuzz and scale probes                          |
| M3        | Sessions, bounded incremental checkpoints, complete-candidate narrowing and custom policies       | Dense equivalence across edits, K changes and eviction; shared budgets; browser keystroke measurements                       |
| M4        | Server deltas/tombstones, live masks, atomic adoption, manifests and compaction                   | Failure retention, session/ref lifetime, generations/descriptors, one-to-eight segments and canonical byte equality          |
| M5        | Explanations and original-position mapping                                                        | UTF-16 coordinates, halfwidth marks, deterministic ties, independent alignments and ref validation                           |
| M6        | Bounded intent parser and DAG search                                                              | Complete-expansion oracle for small cases, exponential-choice non-expansion, grammar/depth/node budgets                      |
| M7        | Measured optional optimization decisions                                                          | Keep scalar preparation/compilation improvements; retain baseline WASM; reject unproven optional engines                     |

See [validation](spec/validation.md#section-14-1) for acceptance IDs and [acceptance](acceptance.md) for dated evidence. Current artifact ownership and APIs are defined by [runtime](spec/runtime.md), not old builder proposals. Later native analysis, query lookup and position ranking are described in the current guides.

## Rules shared by every change

1. Check correctness with upstream fixtures, independent DP and cross-engine comparisons. An implementation using the same optimization is not an independent oracle.
2. Validate types, counts and capacities before allocation. Stage and atomically adopt updates; failure retains the active index and applied manifest.
3. Keep Rust unsafe-free and document copied-result/ref lifetimes, disposal and update serialization.
4. Pin dependencies, upstream hashes, seeds and locale. Verify the packed distribution independently. Run rustfmt/Clippy, Biome and separate TypeScript checks.
5. Use controlled paired measurement for performance decisions. Shared CI correctness checks do not impose noisy timing thresholds. Separate configured budgets, observations and guarantees.
6. Report delivered scope, remaining gates, commands/counts, deviations, benchmark conditions and unverified items. Failed runs are not counted as successes.

## Publication and future changes

Rust Release CI builds and validates OS-specific CLI/WASM Assets. The demo consumes a verified tag, runs integration/UI regressions and deploys through its own workflow. Hosted results must be checked from the actual Actions run; local tests alone do not prove Pages delivery. No automatic push, tag or npm publication is implied by local validation.

Keep public API/format/normalizer changes versioned. Preserve historical observations instead of rewriting their measurements to describe a newer implementation. Performance shortfalls require measuring the workload and planner/budget choices, not relaxing correctness.
