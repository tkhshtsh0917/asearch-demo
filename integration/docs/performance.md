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
