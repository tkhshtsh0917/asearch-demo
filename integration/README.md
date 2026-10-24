# WASM integration workspace

[日本語](README.ja.md)

This workspace owns the TS/JS API, wasm-bindgen glue generation, browser regression tests, compatibility oracles and measurement tools. Rust sources live in [asearch](https://github.com/tkhshtsh0917/asearch).

Record a published tag and OS-specific Release Asset checksums in the root `release.lock.json`, then run `pnpm engine:build` from the demo repository root. This workspace neither retrieves Rust source nor runs Cargo builds.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm test:browser
pnpm test:bench
pnpm fixtures:check
```

See the [specifications](docs/spec/README.md) for API contracts and the [package README](packages/asearch-wasm/README.md) for usage. Verified WASM and CLI artifacts reside in `.engine/release`. Detailed standalone measurements must not be presented as public README performance guarantees.
