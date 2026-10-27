# Ruri browser encoder probe

[日本語](README.ja.md)

An isolated, CPU/WASM feasibility experiment for cl-nagoya/ruri-v3-30m. It does not change the production demo or implement a vector store. Queries stay in a dedicated browser Worker. The model and tokenizer are pinned in model.lock.json; generated assets and timing records are ignored by Git.

The first implementation uses @huggingface/tokenizers 0.2.0 and ONNX Runtime Web 1.31.1 directly, keeping the runtime JS/WASM from the same installed package. The [official Ruri card](https://huggingface.co/cl-nagoya/ruri-v3-30m) defines 256 dimensions, role-specific retrieval prefixes and mean pooling including prefix tokens. The [community ONNX conversion](https://huggingface.co/onnx-community/ruri-v3-30m-ONNX) is a separate artifact and still needs quality comparison against native F32 inference.

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
- Asset loading is from localhost, with HTTP caching disabled by request routing. The results do not measure real internet model downloads, persistent-cache initialization, full search UI latency, native-reference fidelity or physical mobile performance. Mobile profiles emulate layout/device settings on the host machine.

Timing files contain source/model/runtime identities and explicit conditions. Treat E0 as preliminary evidence; full quality, cache, memory and end-to-end gates remain necessary. There is no fixed browser-inference latency guarantee.

## Attribution

The upstream model and the selected ONNX conversion declare Apache-2.0. Preserve their model-card attribution and license requirements when redistributing assets. Tokenizers.js and ONNX Runtime retain their own dependency licenses. No model weights are stored in source Git.
