# Integration workspace

- Own the TS API, bindings generation, browser tests, oracles and benchmarks here.
- vectide/ owns the optional Vectide consumer adapter and conformance tests; the Rust product remains in its own repository.
- Verified Release Assets are prepared under `.engine/release`; do not fetch Rust source or use a sibling checkout implicitly.
- Run pnpm build, typecheck, lint, test and test:browser in this directory.
- Keep comments focused on behavior and responsibility; preserve legal notices and compatibility contracts.
