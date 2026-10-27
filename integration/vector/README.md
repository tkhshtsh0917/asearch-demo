# Vector-store browser integration

[日本語](README.ja.md)

This private TypeScript workspace consumes explicit native CLI/raw WASM assets. It owns safe byte ingress, client-branded snapshot handles, cooperative browser scheduling and independent native/WASM conformance. Rust engine/build sources remain in vector-store. It publishes no npm package.

## Prepare and check

From this directory, install the repository's pinned Node.js/pnpm environment and run:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm prepare:assets /path/to/verified-release-bundle
pnpm build
pnpm test:browser chromium
```

The path is an explicit input, not an inferred sibling checkout. A bundle contains release.json, SHA256SUMS, native vector-store, raw vector_wasm.wasm and project licenses. Preparation checks the schema, source identity, file lengths and SHA-256, then uses matching wasm-bindgen 0.2.129 to generate web bindings. It calls the supplied CLI to build base/delta/compacted fixtures and exact query oracles. It does not compile Rust. Dirty-source development bundles require an explicit --allow-dirty argument; production assets must identify a clean source.

Other browser profiles are firefox, webkit, android-profile and iphone-profile. Run them serially on the shared preview port. Tests cover exact native rankings, pre-top-k filters, updates/restore, handle ownership, malformed input, typed-array subclasses/custom getters, detached buffers, cancellation and recovery. Mobile profiles are host emulation, without a physical-device or browser-inference memory guarantee.

The asset command replaces only its generated .artifacts area and fixture/binding outputs. Bulk question/vector data belongs to the ignored .data area. Ordinary unit/type/lint checks do not download models or read another repository.

## Adapter responsibilities

VectorClient accepts a verified manifest and a caller-supplied bounded artifact stream. The caller enforces allowed origins, decoded byte limits, publication identity and latest-request rendering. The client keeps numeric handles private, copies typed arrays through intrinsic metadata and methods, and releases failed tasks while preserving prepared snapshots.

Exact vector search and model inference are separate. The [Ruri experiment](../experiments/ruri/README.md) owns the initial pinned browser encoder; application integration must keep it optional and preserve primary lexical availability.

The browser regression deliberately exhausts the module's 512 MiB linear-memory maximum with bounded, unfinished uploads. A failed fallible allocation must clear staging, release retained upload reservations and permit a later valid query. This is distinct from a host browser process-memory guarantee.
