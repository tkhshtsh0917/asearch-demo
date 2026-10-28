# Optional semantic suggestions

[日本語](ja/semantic.md)

The playground can consume Vector Store's explicit native/WASM bundle beside asearch v0.4.0. Rust source and document construction stay outside the browser application. Query encoding is an **opt-in experiment** using pinned Ruri v3 30m ONNX q8, not a generally accepted browser-memory profile. Normal lexical search does not fetch the model.

## Prepare a prospective publication

Prepare the ordinary primary assets first, install the pinned tools in integration/vector and integration/experiments/ruri, and install its declared tools with mise. The explicit semantic command prepares the pinned probe model/runtime files. From the repository root:

```sh
pnpm data:index
pnpm semantic:prepare /path/to/verified-vector-bundle
BASE_PATH=/asearch-demo/ pnpm build
SEMANTIC_REQUIRED=1 pnpm exec playwright test semantic --workers=1
```

The test selector includes every semantic spec in the checked-in configuration, including coordinator and inference-Worker recovery. `SEMANTIC_REQUIRED=1` prevents missing optional assets from silently skipping these tests.

The bundle is an explicit verified input. No adjacent Rust checkout is built. Development bundles require `--allow-dirty`; this is not a release setting. The command runs the locked native F32 document encoder, verifies reusable vector-cache provenance, builds base/delta/compacted VECX through the supplied CLI, and attaches a hashed optional publication to the primary release pointer. Generated data, model files and bindings remain outside source Git. Without explicitly prepared assets, ordinary builds retain lexical search and disable the semantic button. If primary catalogs change, attachment fails and the semantic publication must be rebuilt.

Only original question text is embedded with the document prefix. Titles, answers, snippets, romanizations, synonyms and lexical normalization are excluded. Three changed questions and the added synthetic question are re-encoded server-side; one deleted ID is tombstoned. Compaction preserves the updated content. The 50k scaling benchmark is separate; the UI still uses 10k questions.

## Runtime behavior

The activation button explains the approximately 80 MB decoded first-use cost, including model, runtime, Worker code and vectors. Model inference and vector search run in dedicated Workers, independently of primary lexical search. The core vector module is scalar; the selected ONNX runtime additionally requires browser WASM SIMD. No query-bearing HTTP request or automatic server API fallback is used. Model cache entries are hash-checked; unavailable or quota-limited IndexedDB falls back to verified static fetches without storing queries.

After activation, a committed input runs semantic search after a 150 ms debounce when the filtered lexical total is zero, or when the user explicitly presses the button. Uncommitted IME text continues primary incremental search but never invokes semantic inference. A running inference is not claimed to be interruptible: the coordinator retains at most one running and one latest pending request. Query, filter, stage and reload changes invalidate old results and errors. Timeouts discard a failed inference Worker so a later request can retry.

Worker failures retire the failed instance even if its originating request has been superseded. Only status updates are guarded by the current request token; a later attempt starts a fresh Worker. Synchronous construction failures and message-decoding failures are also reported without disabling primary search.

An inference Worker's `messageerror` immediately rejects the running encoding request and retires that instance, allowing the coordinator to advance to a pending query without waiting for the 120-second timeout. Request completion removes its listeners and timer. Late callbacks from a completed request cannot retire a replacement or a reused Worker; synchronous send failures use the same cleanup path.

The semantic group contains up to five nearest questions, ordered by exact cosine distance and stable ID. It excludes primary displayed IDs before top-k. There is no lexical/cosine score mixing, no relevance cutoff and no claim that a nearest neighbor is a correct answer. The button remains available when lexical results exist. The independent held-out JMTEB subset measures encoder fidelity; it is not a human usefulness evaluation of the playground or a tuned no-answer detector.

## Coherence and facets

An application publication binds the primary manifest name and catalog SHA-256, vector-manifest SHA-256, embedding-space identity and exact encoder profile. Preparation verifies every vector digest, content revision, row count and live-ID digest before adoption. An incompatible or failed optional stage cannot replace the primary state. Restore selects the complete base publication; compacted vectors retain updated content.

Article selections use OR, change selections use OR, and the two axes combine with AND. These filters apply to the complete matching catalog before vector top-k, independently of lexical matches. Empty eligibility is distinct from no filter. Left-side facet counts describe **lexical matches only**; they do not describe global semantic match counts. Semantic results use the same safe text/snippet/source-link rendering and change labels as the primary group.

Browser regressions cover actual encoder/vector execution, failure recovery, stale responses, IME invalidation, stage transitions and 320 px layout under the production CSP and Pages prefix. Compatibility is limited to the tested Playwright engines/mobile profiles; there is no physical-device memory or latency guarantee.

Prepared application catalogs are cached for at most three stages under one immutable publication. A publication change discards that cache and its vector client. Native document-cache identity uses only stable IDs and original question text, plus captured model/script/Python-lock hashes; display-only metadata changes do not force re-encoding. A mismatched or changed encoder cannot publish cached vectors under a different profile.

The consumer release-verification workflow accepts an explicit public Linux archive URL and SHA-256, checks a bounded regular-file tar layout, verifies the native target/version and all five payload digests, and runs the three-engine/two-mobile conformance fixture. It does not enable or deploy the experimental model automatically.

Vector artifacts/manifests and binding directories use content-derived names; the encoder directory is bound to the exact model/runtime/semantics profile. Ordinary HTTP cache reuse therefore cannot silently select a previous profile at a mutable filename. Publication checks that URL relocation preserves the native snapshot and exact results. It also verifies each copied model/runtime byte and rejects source changes during preparation. Static deployments retain only their published asset set; an old tab may need a full reload after deployment if a retired asset is no longer hosted.

After activation, verified catalog-wide article/change choices remain available even when lexical counts are zero. These zero counts retain their lexical meaning; they are not semantic match estimates. Choices are cached under the current publication and invalidated on stage/reload changes. The existing keyed checkbox/chip rendering preserves keyboard focus and Space activation.

The checked-in model-assisted page is an explicit local experiment. Normal CI/Pages builds do not include the model unless its assets are supplied and checked. The primary engine stays usable without them.

## Measured application interaction

On 2026-10-28, Chromium 156 on an Apple Silicon macOS host loaded the 10k publication over loopback. Primary readiness was 441 ms; the first explicit semantic activation took 1.36 s. Files requested by that activation totalled 80,072,371 decoded bytes, including the separately fetched display catalog. This sums unique requested static files, including HTTP-cache responses; it is not compressed wire traffic. A throttled cold model-only experiment is reported separately in the [encoder probe](../integration/experiments/ruri/README.md).

After five warmups, forty automatic zero-lexical queries had 195.3 ms p50 and 202.7 ms p95 from committed input to accepted DOM mutation. This includes the deliberate 150 ms debounce, primary/semantic queueing, encoding, exact search and rendering. Five fixed synthetic phrases exercise the pipeline; they are not a relevance benchmark, a network-cold p95 or a device guarantee. Asset and harness hashes are checked before and after measurement.

The application revision was `5e34976e755e0058aeeeaf1aab796b2c7b1e98ae` (clean), with harness `17ce4cb3fe5061a5324617dfb6dcfa17c838e971`, using the vector bundle from `9ca185c320d118faac16e9669df69509de4e0fab` and encoder profile `6f7bd88f8903d3cb27d0bc64ebee4e3d2e4a8aa9fea3d57e350c3a72713dbdc7`. With prepared assets and the production-prefix build above, reproduce the separate interaction measurement with:

```sh
node tools/semantic/bench.ts
```
