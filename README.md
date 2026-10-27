# asearch-demo

[日本語](README.ja.md)

A Japanese search demo built from the Rust Asearch Release Assets. `integration/` owns the TS/JS API, glue generation and browser regression tests; this repository's root owns the UI and data publication. Matching and normalization algorithms live in the [Rust repository](https://github.com/tkhshtsh0917/asearch).

Search runs during IME composition and follows the latest value after commit, candidate replacement or cancellation. It preserves input text and selection. Browser coverage consists of Playwright tests, including synthetic IME events.

A failed query can recover through a later successful search without restarting the Worker. Query errors clear only when a newer result is adopted; superseded responses cannot clear current errors. Publication errors remain visible independently.

The server-only Rust analyzer generates readings, romanizations, synonyms and query lookup data. Original questions remain unchanged; auxiliary `texts` use ASIX v1. Whole-term verb normalization makes `食べた` and `食べる` search the same query. Whenever bounded conversion changes an input, mixed input such as `びーt` → `bi-t` or `にh` → `nih` searches both forms and deduplicates their candidates. Corpus results rank by edit distance, match start, order and key. See [search analysis](docs/search-analysis.md) for scope and limits.

The committed setup uses the published Rust CLI and WASM **v0.4.0** Release Assets. Native query-rule export and positional ranking require compatible 0.3+ artifacts; updating the version requires checksum verification and regression tests.

On the results screen, a left sidebar provides article and update-status checkboxes, with multiple choices and keyword-dependent counts. Mobile screens offer a collapsible panel. Selected filters remain visible as removable chips, including zero-count selections after restore. See [facets](docs/data.md#article-facets) for the OR/AND rules and limits. Short, plain-text excerpts from the original `text` passages provide context; they are not generated answers or additional searchable content.

An explicitly prepared [optional semantic experiment](docs/semantic.md) adds pinned browser encoding and an independent exact-vector suggestion group. It is disabled in ordinary builds until its native/vector/model assets are supplied; the primary release pin remains v0.4.0.

## Setup

Use mise for Node/pnpm, `unzip` for the system dictionary, and wasm-bindgen-cli 0.2.129 to match the selected Rust Release. The demo does not build the engine's Rust source. `release.lock.json` pins published v0.4.0 and all three OS bundle checksums. The commands below select that same Release with `tools/engine/select.ts`; missing OS checksums stop preparation.

```sh
mise install
cargo install wasm-bindgen-cli --version 0.2.129 --locked
mise exec -- pnpm --dir integration install --frozen-lockfile
mise exec -- node tools/engine/select.ts v0.4.0
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

## Development

See [Contributing](CONTRIBUTING.md) for validation commands, code/test guidelines and documentation updates. The [build guide](docs/deployment.md) explains static-site artifacts and version identity; the [performance guide](docs/performance.md) covers Worker round trips and DOM measurements.

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
