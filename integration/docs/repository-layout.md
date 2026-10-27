# Repository layout and dependency direction

[日本語](ja/repository-layout.md)

`asearch` owns Rust matching, formats, native analysis/building, CLI, WASM boundaries, Rust tests and fuzzing. After Rust quality checks, tag CI publishes WASM/CLI/license bundles for each OS with SHA256SUMS.

`asearch-demo` retrieves pinned Assets, verifies SHA-256, generates JS glue and the TS API, runs regressions and UI E2E, then deploys successful builds to Pages. Ordinary builds do not retrieve or rebuild Rust sources.

- `packages/asearch-wasm/src`: TS API and environment initialization.
- `packages/asearch-wasm/test`: API/type/distribution regressions; downloaded CLI for native comparisons and fixtures.
- `tests/browser`: WASM, Worker and browser-boundary verification.
- `tests/fixtures`: CLI-based ASIX setup for Node/browser tests, excluded from distributions.
- `tools/build`: wasm-bindgen, optimization and JS distribution generation.
- `tools/fixtures`, `tools/reference`, `vendor/upstream`: Independent oracles and compatibility fixtures, retaining original licenses and hashes.
- `tools/bench`: Native CLI, Node and browser measurements.
- `experiments/ruri`: An isolated [browser embedding probe](../experiments/ruri/README.md), with its own pinned dependencies, offline checks and explicit model preparation; not part of the production demo build.
- `fixtures`: Fixed JS regression inputs; Rust keeps identical fixtures for independent tests.
- `.engine/release`: Verified, Git-ignored Release Assets.

The demo root's `src` and `tools` own UI, IME, corpus and publication assets. They do not reimplement Rust matching or normalization. The UI may apply bounded server-generated query lookup data as an explicit query policy. Retain licenses in each distribution. Nothing is published to npm.
