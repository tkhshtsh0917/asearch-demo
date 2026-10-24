# Performance harness

[日本語](README.ja.md)

Implemented during M1. Node and Playwright Chromium/Firefox/WebKit compare vendored upstream JS with fixed-level Rust/WASM adapter matching: asearch.ts-lib, Include, level 3. This does not measure bulk indexes or incremental input.

```sh
mise exec -- pnpm build
mise exec -- pnpm test:bench
mise exec -- pnpm bench:node OUTPUT_JSON 10000
mise exec -- pnpm exec playwright install chromium firefox webkit
mise exec -- pnpm bench:browser OUTPUT_BROWSER_JSON 10000
mise exec -- pnpm bench:compare BASELINE_DIST CANDIDATE_DIST OUTPUT_JSON BASELINE_COMMIT CANDIDATE_COMMIT 10000
mise exec -- pnpm bench:native OUTPUT_NATIVE_JSON 10000
```

OUTPUT_JSON is the measurement-log destination. UNITS ranges from 10,000 to 10,000,000; seed is 31. Do not run builds/tests concurrently. The generator uses 3,000 BMP symbols, Zipf exponent 1.05 and text lengths 10–60.

Before timing, verify every text at levels 0–3 for each pattern. Patterns contain 3/7/15/31 symbols. Exclude construction; each sample is the mean match time over all candidates. Adjust batch repetitions to exceed timer resolution. Alternate five paired AB/BA runs with 30 samples each and bootstrap per-run median ratios. Reported p50/p95 describe **batch-mean distributions**, not individual keystrokes.

JSON records raw samples, seed, SHA256 of corpus/upstream/WASM/JS adapter/lockfile, HEAD, UTC timestamp and Node/V8/OS/CPU. Node upstream executes in a VM context; browser upstream uses Function with a dedicated CommonJS/verbose shim. Product Node calls use the Node entry. These call paths are included and are not isolated-core timing.

Each runner records a dirty boolean. Dirty HEAD alone cannot identify measured source: retain artifact/runner hashes and the measured diff. Changed workstation filenames are not stored in JSON.

Statistics tests cover synthetic noise, known regressions above 10%, independent confirmation and fixed-seed reproducibility. One five-run group cannot confirm regression. Browser engines are measured sequentially.

Node/browser replicaResults compare fixed-level matching with a plain JS port without verbose/process calls. Vendored originals are unchanged; the replica is separately checked against all fixtures and is benchmark-only. extensions.minimumLevels compares JS calls at 0..K against one product matchLevel call, with equal per-text minimum levels but no key ranking/top-N. Both use the same timers, corpus and AB/BA design.

extensions.construction invokes a constructor each time and immediately frees implementations with free. The final instance remains observable to prevent unused construction from disappearing. Upstream JS GC is delayed, so release costs are not equivalent; this is a constructor/free diagnostic, not a controlled live-count/GC speed claim. Both extension categories use batchMeanOperationMs percentiles, distinct from fixed-level matching and individual keystrokes.

bench:compare loads two built distributions in one Node process and compares the same corpus in AB/BA order. Do not divide independent historical JSON reports. BASELINE_COMMIT and CANDIDATE_COMMIT are the 40-digit commits that built each distribution. Build with the same toolchain/dependencies and record actual versions. The caller verifies commit labels against artifacts. The runner records both WASM/JS/glue SHA256 values plus corpus/harness hashes, never workstation paths.

A regression candidate in any of four patterns triggers a second five-run group for all patterns, confirmed separately. p50/p95/p99 are distributions of 150 batch means. Free both handles after each pattern and on abnormal exit where supported. Constructor/free time is excluded from fixed-level timing.

bench:native passes the same workload to the CLI. It compares native Ideal Asearch match_level per text against ScalarEngine<u32> full-level scanning after verifying all levels. Settings: no normalizer, Rust casing, Include, K=3. Both are native; this is neither a JS ratio nor top-key ranking. Use Instant, ten warmups, five runs × 30 samples, AB/BA and common repetitions targeting at least 4 ms (cap 1,024). JS uses the same aggregation module. Record raw samples, corpus/executable/Release NOTICE/runner/aggregation SHA256, pinned tag, demo commit and Node/OS/CPU. Prepare verified Release Assets before timing. A single comparison of these two implementations is not before/after regression evidence.

Direct CLI usage: asearch-cli bench INPUT_JSON OUTPUT_JSON. Input matches workload seed/units/texts/patterns, with JSON <=64 MiB, 1–64 patterns and actual/declared units equal in 10^4–10^7 UTF-16 units. Patterns fit native Asearch's 31 UTF-16 units; longer-pattern correctness is checked separately in Rust tests.

## Bulk incremental input

For two distributions using the same engine, follow [version comparison](../../docs/performance.md). The following compares blocked and auto within one distribution.

```sh
mise exec -- pnpm bench:session INPUT_ASIX OUTPUT_JSON node
mise exec -- pnpm bench:session INPUT_ASIX OUTPUT_JSON browser
```

INPUT_ASIX is a caller-provided ASIX base; the engine embeds no dataset. Browser runs are sequential across the three engines. Verify the index SHA256 in browsers too and serve only that additional file on localhost.

Blocked/auto sessions share an index, default policy, countTotal=true and limit=30. Ten warmups precede five runs × 50 rounds of four sequences/21 keystrokes (extension, deletion, suffix replacement, halfwidth marks and empty input), alternating AB/BA. Time each update individually; compare ids/levels/orders/exact totals outside timing. Exclude reset/construction/load/rendering. Retain raw samples, engine counts, sample counts, percentiles, environment and artifact hashes. Preserve zero-ms samples from coarse clocks, but do not divide by zero. These are not universal thresholds or device guarantees.

## Multiple segments

```sh
mise exec -- pnpm bench:segments OUTPUT_JSON node
mise exec -- pnpm bench:segments OUTPUT_JSON browser
```

Split a fixed synthetic 10,000-document/20,000-text corpus into 1–8 segments and compare with the same full index in AB/BA order. Record 1,300 searches per segment count/path (13 inputs × five runs × 20 rounds), checking ids/levels/orders/exact totals and compacted bytes. Current client lifecycle timing measures load/update only; CLI fixture construction/compaction is outside timing. Historical pre-separation measurements timed load/compaction/update 30 times on fresh roots after three warmups. Sources are in-memory bytes, not HTTP. Initial standalone observations are diagnostic, separate from the 30-sample distributions. Load/update include expected SHA-384 validation. After eight segments, updates replace the whole column with compacted base plus delta, unlike append cases.

WASM memory byteLength reports nonshrinking pages. Earlier scenarios in the same instance affect it; it is not live allocation or an exact operation peak. Synthetic results do not establish real-data relevance or device performance. Local 2026-10-21 runs observed segment-search overhead and higher full-replacement load costs. Small deltas plus periodic compaction remain the policy; provisional thresholds are not universally optimal.

Final local session measurements on 2026-10-21 ran 5,250 updates/path over 21-keystroke sequences on 10,000 real questions in Node/three browsers. Node auto had lower p95 but worse medians in some groups. Chromium showed tail improvement; coarse Firefox/WebKit clocks do not support speed ratios. This is one corpus, short sequences and one environment, not universal superiority. See [D28](../../docs/DECISIONS.md#d28-m7の採否とスカラー経路の改善).
