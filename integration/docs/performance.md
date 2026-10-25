# API performance comparisons

[日本語](ja/performance.md)

This guide describes the comparison contract. The [benchmark tool guide](../tools/bench/README.md) is authoritative for commands, workload options and report fields. [Core performance decisions](https://github.com/tkhshtsh0917/asearch/blob/main/docs/performance.md) records adopted optimizations and scoped effects; the [demo guide](../../docs/performance.md) covers Worker/DOM timing.

## Equivalent artifacts and inputs

Prepare two explicit distributions and the same ASIX before timing. Use the same compiler/dependencies and matching semantics. Record source commits, artifact/harness hashes, corpus/workload identities and runtime/browser information. Source labels alone do not prove artifact provenance. Do not run builds, tests or other measurements concurrently.

The common search settings are WildcardSpace (`mode: 2`), `wrap: true`, exact totals and a by-length edit budget (every 4, maximum 3, profile units, excluding wildcards). The default output limit is 30; workloads can override `limit`. Explanation setup uses its requested `count`. Optional `ranking` accepts `stable` or `position`; omitting it preserves compatibility with older stable-order artifacts. Both sides must support the selected settings.

The comparison snapshot includes IDs, levels, order, totals and optional starts, excluding owner-specific opaque refs. Positional comparisons require starts. Search, load-validation and explanation setup share that snapshot and settings. Reports record the options actually applied to each side.

## Timing boundaries

Session/full-search measurements time individual public calls including JS/WASM transfers and copied results, excluding loading, reset, HTTP and rendering. Load comparisons include in-memory validation and expected SHA-384 verification. Explanation and narrow-operation batches report batch means, not individual-keystroke percentiles. See the tool guide for each operation's boundaries and prerequisites.

## Paired interpretation

Alternate AB/BA and retain whole paired runs. Preserve timer zeros; ratios whose selected run quantile is zero fail as below resolution. Bootstrap whole paired runs, not individual keystrokes, and confirm results in a separate process/group. Inspect both typical and tail regressions. Repeated fixed traces are not independent query coverage, and shared CI has no noisy speed threshold.

A result mismatch invalidates a speed claim. Identical-artifact comparisons test the harness, not an implementation improvement. Separate Rust capacity budgets, WASM linear memory and process/browser RAM. Emulator measurements do not guarantee phone hardware performance.
