# asearch-demo

[日本語](README.ja.md)

A Japanese search demo built from the Rust Asearch Release Assets. `integration/` owns the TS/JS API, glue generation and browser regression tests; this repository's root owns the UI and data publication. Matching and normalization algorithms live in the [Rust repository](https://github.com/tkhshtsh0917/asearch).

Search runs during IME composition and follows the latest value after commit, candidate replacement or cancellation. It preserves input text and selection. Browser coverage consists of Playwright tests, including synthetic IME events.

The server-only Rust analyzer generates readings, romanizations, synonyms and query lookup data. Original questions remain unchanged; auxiliary `texts` use ASIX v1. Whole-term verb normalization makes `食べた` and `食べる` search the same query. Whenever bounded conversion changes an input, mixed input such as `びーt` → `bi-t` or `にh` → `nih` searches both forms and deduplicates their candidates. Corpus results rank by edit distance, match start, order and key. See [search analysis](docs/search-analysis.md) for scope and limits.

These features require Rust CLI and WASM 0.3+. Until that release is published, local verification requires explicitly supplied development artifacts. `ASEARCH_ANALYZER_CLI` can name a built analyzer CLI; it does not replace the WASM artifact. Switch to published Release pins after publication.

## Setup

Use mise for Node/pnpm, `unzip` for the system dictionary, and wasm-bindgen-cli 0.2.129 to match Rust's Cargo.lock. The demo does not build the engine's Rust source. Select a published tag and OS bundle checksums with `tools/engine/select.ts`; missing OS checksums stop preparation. The committed initial pin records actual v0.1.0 checksums. Do not fabricate unpublished asset checksums. The following example requires v0.3.0 to have been published.

```sh
mise install
cargo install wasm-bindgen-cli --version 0.2.129 --locked
mise exec -- pnpm --dir integration install --frozen-lockfile
mise exec -- node tools/engine/select.ts v0.3.0
mise exec -- node tools/engine/build.ts
mise exec -- pnpm install --lockfile-only --update-checksums --ignore-scripts
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm analysis:prepare
mise exec -- pnpm check
mise exec -- pnpm data:prepare
BASE_PATH=/asearch-demo/ mise exec -- pnpm build
mise exec -- pnpm preview --base /asearch-demo/
```

`engine:build` verifies the bundle's SHA-256, generates JS glue and the TS API, and packs the adapter. After intentionally updating a version or adapter, validate and update the root pnpm-lock.yaml. CI uses frozen installation after resolving its exact release. Explicit local bundles use `node tools/engine/build.ts PATH_TO_ASSET_DIRECTORY`. A sibling Rust checkout is never used implicitly.

## Validation and deployment

```sh
mise exec -- pnpm --dir integration typecheck
mise exec -- pnpm --dir integration lint
mise exec -- pnpm --dir integration test
mise exec -- pnpm --dir integration test:browser
mise exec -- pnpm test:dev
mise exec -- pnpm test:e2e
```

## Responsibilities

- `src/`: Worker, IME handling, search UI and rendering.
- `integration/packages/asearch-wasm`: TS API and generated distribution.
- `integration/tests`: Browser-level library verification.
- `integration/tools`: Glue generation, fixtures/oracles and measurement.
- `tools/engine`: Release Asset retrieval and verification.
- `tools/analysis`: Upstream language-resource retrieval, pinning and native analyzer invocation.
- `tools/data`, `tools/site`: Corpus retrieval and CLI-based index/delta/attribution generation.

The fixed scenario uses the first 10,000 AutoWikiQA questions and indexes question text only. The UI can apply a delta, load its compacted equivalent, restore the initial snapshot or restart the Worker. See [data and attribution](docs/data.md), [library specifications](integration/docs/spec/README.md) and the [documentation index](docs/README.md).

## License

The demo is MIT. The adapter is MIT OR Apache-2.0; upstream sources and NOTICE retain their respective licenses. AutoWikiQA-derived data is CC BY-SA 4.0.

## Acknowledgments

[asearch.ts](https://github.com/teramotodaiki/asearch.ts) informed the matching design and compatibility baseline. Original upstream files and licenses remain under integration/vendor.

Browser WASM is read-only. The downloaded CLI builds and compacts indexes. For an initial Release or asset update, verify the SHA-pinned tarball from `engine:build`, update the root lockfile with `pnpm install --update-checksums`, then perform frozen installation and regression checks.

In a historical same-tool comparison, moving index construction to the CLI reduced raw WASM from 298,174 to 285,543 bytes (about 4.2%), with reductions under gzip/Brotli too. This does not establish search speed or the size of later versions.

The [demo performance guide](docs/performance.md) explains Worker round-trip and DOM timing.
