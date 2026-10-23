# Measuring the demo

[日本語](ja/performance.md)

Core/API comparisons live in [integration's performance guide](../integration/docs/performance.md). The demo additionally measures Worker messages and accepted DOM updates:

```sh
BASE_PATH=/asearch-demo/ mise exec -- pnpm build
mise exec -- pnpm preview --base /asearch-demo/ --port 4185 --strictPort
# In a separate terminal, after the build and preview startup finish:
mise exec -- node tools/bench/ui.ts http://127.0.0.1:4185/asearch-demo/ OUTPUT_JSON
```

Prepare the pinned Release Assets and corpus as described in the README before building. The runner accepts loopback URLs, runs Chromium, Firefox and WebKit sequentially, and injects observers only into its test pages. It does not add telemetry to the product. Run it from this repository, serve its `dist/` at the supplied URL, and keep that build unchanged; the report hashes local built assets and the harness. When testing a pre-release local bundle, separately retain its source, raw asset hashes and temporary lockfile rather than treating the development pin as a published Release.

Each browser uses a fresh context. The ready observation includes navigation, Worker startup, local HTTP retrieval, validation and index setup, but is a single diagnostic sample with no cold OS-cache claim. Twenty-eight rounds of eight committed query changes are replayed, discarding three warmup rounds. The remaining 200 samples retain Worker-reported search/explanation time, main-thread request-to-response time and request-to-accepted-DOM-mutation time. DOM changes happen in the app's animation-frame callback; this is **not paint completion**. Round trips include serialization, scheduling and Worker execution. Separate performance clocks mean Worker elapsed is an approximate component, not an exact subtraction from main-thread timing.

Every input waits for a corresponding accepted DOM mutation. The runner checks sample counts, nonnegative finite timers, message errors and DOM-after-response ordering. This is a sequential-response benchmark; rapid input cancellation, delayed updates, accessibility and mobile emulation remain covered by `pnpm test:e2e`. No timing threshold is a CI assertion. The optional observer adds overhead, there is no network shaping, and desktop measurements do not guarantee phone performance. Network transfer, WASM compilation and instantiation are not individually attributed by this UI runner; use API load comparisons for the separately observable in-memory construction cost.
