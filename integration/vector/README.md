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

## Native document vectors and 50k benchmark input

`node tools/corpus.ts` retrieves the immutable 50,000-question prefix in corpus.lock.json using bounded HTTP ranges, then checks the complete materialized subset SHA-256. It does not claim verification of the whole Parquet shard. This CC BY-SA 4.0 derivative retains the source dataset/revision/license pins; no answers or source passages are embedded.

```sh
mise exec -- uv run --script --locked tools/embed.py --input .data/wiki50k-questions.jsonl --output .data/vectors.jsonl --limit 50000
python3 -m unittest discover -s tools -p 'test_*.py'
```

The locked native F32 encoder uses only `text`, adds the document prefix, checks all token counts without truncation, and emits stable IDs plus 256 coordinates. It captures the consumed input digest, model/script/Python-lock digests and timing conditions. Output and staging files cannot overwrite existing files. Offline I/O tests do not import the ML runtime. On the measured host, 50k documents took 74.41 seconds, with a maximum of 87 tokens under the fixed 256-token policy. This is a server encoding observation, not browser query latency or a portable throughput guarantee.

## Cooperative scheduling measurement

`tools/bench.ts BUILD_DIRECTORY LABEL` measures an explicitly built adapter against a 10k native oracle, recording actual JS/WASM hashes. It includes loading and cooperative query yields, and excludes encoding. Five warmups precede forty repeated queries. In a sequential Chromium confirmation with identical WASM/data, timer yielding gave 200.8 ms query p95 and 1185.4 ms preparation; MessageChannel gave 1.9 ms p95 and 196.5 ms preparation. These host observations isolate adapter scheduling, not model latency or portable device guarantees. Ports are client-owned, the queue is bounded to the two possible concurrent task yields, and disposal resolves pending yields before closing ports. Cancellation, budgets and exact oracle agreement remain covered.

Release bundles also contain `THIRD-PARTY-NOTICES.txt`. Preparation verifies all five supplied files before executing them, stages bindings/native oracles away from active outputs, and rolls back all output directories if installation fails. Source/binding/fixture outputs therefore remain usable after a corrupt bundle or failed generation. `node tools/prepare-bench.ts EXPLICIT_BASE_MANIFEST` prepares the fixed scalar query and native oracle for either 10k or 50k; pass the row count as the fourth argument to tools/bench.ts. The 50k browser run uses the explicit expanded profile.

The vector consumer PR workflow also runs Ruff and the standard-library Python I/O regressions in an isolated environment without Torch, Sentence Transformers or model downloads. Locally, `mise run check-python` runs the same lint, formatting and offline unittest checks. Native model encoding remains a separate locked uv operation.
