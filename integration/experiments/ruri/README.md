# Ruri browser encoder probe

[日本語](README.ja.md)

An isolated, CPU/WASM feasibility experiment for cl-nagoya/ruri-v3-30m. It does not change the production demo or implement a vector store. Queries stay in a dedicated browser Worker. The model and tokenizer are pinned in model.lock.json; generated assets and timing records are ignored by Git.

The implementation uses @mlc-ai/web-tokenizers 0.1.6 and ONNX Runtime Web 1.31.1 directly, keeping the runtime JS/WASM from the same installed package. The [official Ruri card](https://huggingface.co/cl-nagoya/ruri-v3-30m) defines 256 dimensions, role-specific retrieval prefixes and mean pooling including prefix tokens. The [community ONNX conversion](https://huggingface.co/onnx-community/ruri-v3-30m-ONNX) is a separate artifact; native F32 comparisons below constrain the approved profile.

## Run

From the repository root, use the pinned mise environment:

```sh
mise exec -- pnpm --dir integration/experiments/ruri install --frozen-lockfile
mise exec -- pnpm --dir integration/experiments/ruri prepare:model
mise exec -- pnpm --dir integration/experiments/ruri check
mise exec -- pnpm --dir integration/experiments/ruri build
mise exec -- pnpm --dir integration/experiments/ruri bench chromium
```

Model preparation explicitly downloads hash-verified assets. Ordinary unit tests are offline and do not require them. Install the matching Playwright browsers before measurement. Other profiles are firefox, webkit, android-profile and iphone-profile; run them serially because they share a local preview port. For manual input, use the dev command after preparation.

A separate CI workflow runs formatting/lint, type checks, offline unit tests, bundle compilation and a dependency audit without fetching models. Weekly dependency auditing and Dependabot also cover this standalone package. Real-model browser measurements remain an explicit local command.

## Contract and measurement scope

- Use `検索クエリ: ` for queries and `検索文書: ` for indexed documents, retaining the ASCII colon and trailing space.
- Mean-pool attention-mask-selected tokens, including the prefix and special tokens; normalize to unit length using F64 arithmetic before rounding to F32.
- Use the pinned q8 conversion. This probe rejects input above 4096 UTF-8 bytes or 256 tokens including the prefix/special tokens, without silently truncating. It is deliberately below the model's advertised context length.
- The model files total 43,778,706 bytes; runtime assets and session memory are additional. Q8 weights do not mean the output vectors are int8.
- One inference runs at a time. Requests time out and recreate the Worker; ordinary validation errors permit reuse of the loaded session. This is a serial probe, not the production latest-query adapter.
- The runner verifies finite unit-length 256-dimensional query/document output, recovery after empty and over-token-limit queries, and static-asset-only network requests. After those validation checks, it records five warm-up queries and 100 timed warm queries, with per-sample token counts and vector hashes; first inference is recorded separately.
- The warm runner loads from localhost with HTTP caching disabled by routing. Separate runners measure native-reference fidelity, retrieval quality and startup/cache conditions. None measures physical mobile performance; mobile profiles emulate layout/device settings on the host machine.

Timing files contain source/model/runtime identities and explicit conditions. Bundles embed a source fingerprint; runners reject stale builds and changed sources. Native references also bind their scripts, environment lock and input hash. There is no fixed browser-inference latency guarantee. Full interaction measurements belong to the application integration.

## Native compatibility and retrieval quality

Run from this directory after model preparation and bundle compilation:

```sh
mise install
mise exec -- uv run --locked --python 3.13 --script tools/reference.py reference-inputs.json results/native-reference.json
pnpm test:parity
pnpm prepare:quality
mise exec -- uv run --locked --python 3.13 --script tools/reference.py .reference/quality/source.json results/quality-reference.json
pnpm test:quality
mise run check-reference
```

The independent native path uses pinned Sentence Transformers/PyTorch CPU F32 inference. Twelve query/document anchors include newlines and mixed scripts; all token IDs agree, and Q8/native cosine is at least 0.9936 in the measured set. The Rust/WASM tokenizer preserves byte fallback that the earlier JS tokenizer missed.

quality.lock.json pins a CC BY 4.0 JaGovFaqs subset distributed by [JMTEB](https://huggingface.co/datasets/sbintuitions/JMTEB). The deterministic token-eligible selection contains 1,000 documents and 128 labeled queries, with native F32 document vectors. Browser Q8 Recall@10 is 94.5%, compared with native F32 95.3%; Recall@10 and nDCG@10 degradation stay below the fixed 0.02 absolute gate. This is a quantization-regression check on a fixed subset, not full JMTEB performance, demo rescue quality or no-answer accuracy. Dataset preparation is an explicit network operation.

## Startup, cache and adoption decision

```sh
pnpm bench:startup chromium --throttle
pnpm bench:startup firefox
pnpm bench:startup webkit
```

The startup server shares a 10 Mbps decoded-body limit across requests and adds an 80 ms first-byte delay when --throttle is selected. It serves fixed local files without HTTP compression. The test enables a one-hour HTTP cache; the warm runner intentionally uses different cache conditions. Chromium's sampled first preparation was about 52 seconds, with about 63.45 MB of requested files; cached model/runtime assets with a new Worker took about 0.35 seconds. Warm inference p95 was 7–8 ms over 100 requests per profile on one host. These observations are not internet or physical-device guarantees.

The optional IndexedDB cache stores six hash-keyed model/runtime blobs, totaling 58,627,558 decoded bytes under a 64 MiB/16-entry admission cap. Readback verifies length and digest. Same-size corruption is replaced from the pinned source. Storage errors or quota denial fall back to verified fetches; no query history is stored. fetchedDecodedBytes counts fetch body bytes, including browser HTTP-cache responses, rather than wire transfer.

The recorded experiment targets are 90 seconds cold preparation, 10 seconds cached initialization, 100 ms warm round trip, 64 MiB fresh decoded resources and 1 GiB summed browser-subtree RSS. They are not all met: Firefox exceeds the RSS target; WebKit Blob persistence fails with UnknownError in the tested environment, while inference continues. A comparable total WebKit RSS is unavailable because macOS can launch content processes outside the sampled subtree. RSS sampling can double-count shared pages and miss peaks. --require-budget makes unmet/unknown targets fail after saving the record.

Keep browser encoding an explicit opt-in experiment. Preserve lexical availability and expose loading/unavailability; do not enable model downloads automatically or claim all-browser memory acceptance. The vector-store engine has its own separate, bounded resource and browser checks.

## Attribution

The upstream model and the selected ONNX conversion declare Apache-2.0. Preserve their model-card attribution and license requirements when redistributing assets. Web Tokenizers and ONNX Runtime retain their own dependency licenses. No model weights are stored in source Git.

The encoder Worker accepts a same-origin directory base for application reuse under a Pages path prefix. Replies include the SHA-256 of the exact imported model/runtime profile. Initialization failure disposes the tokenizer, and encoder/probe disposal is idempotent. Redirects are rejected for pinned assets. Startup records distinguish initialization, first inference and a subsequent warm inference; the cold gate includes first inference. Historical ready-only observations are not relabeled as full first-use latency.

Optional IndexedDB transactions also have a two-second deadline; a stalled cache cannot indefinitely block verified network loading. [Redistribution notices](licenses/README.md) distinguish exact package/source pins from the tokenizer upstream's unavailable historical transitive binary SBOM. Dependency registry audits do not cover unknown embedded native versions.

The probe's lifecycle regression cancels an in-flight request during disposal, checks repeated disposal and rejects subsequent requests. Historical initialization-only startup records are retained as such; current records capture ready and first-inference timestamps separately.
