# Historical local acceptance

[日本語](ja/acceptance.md)

## M0–M7 snapshot

The following evidence is dated 2026-10-21 JST. It describes those artifacts, not the latest test counts or hosted deployment. Current reproduction commands are in the [README](../README.md) and [benchmark guide](../tools/bench/README.md); optimization adoption is summarized by [D28](DECISIONS.md#d28-m7の採否とスカラー経路の改善).

| Area               | Recorded result                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Rust               | rustfmt, Clippy with warnings denied and 76 workspace tests passed.                                                                         |
| JS/TS              | Biome/types and 121 tests each on Node 22/24 passed.                                                                                        |
| Browser boundary   | 57 tests across Chromium/Firefox/WebKit passed.                                                                                             |
| Compatibility      | 3,168 fixtures regenerated identically; 17 vendored upstream files matched hashes.                                                          |
| Format/intent fuzz | 31 seconds each under ASan: 5,696,587 ASIX and 114,535 intent iterations, no finding in these finite runs.                                  |
| Measurement        | 13 aggregation tests; 5,250 keystrokes/path, 1–8 segments with 1,300 searches/path and 30 lifecycle repetitions across Node/three browsers. |
| Distribution       | ESM/CJS/Worker, independent packed usage, regeneration on Linux arm64 and dependency notices.                                               |
| Dependency audit   | No known vulnerabilities detected by RustSec/pnpm audit at that time.                                                                       |

Baseline WASM and scalar preparation/shared-compilation improvements were retained. Optional SIMD and other engines were not adopted. Some keystroke p95 results improved while medians worsened; timer resolution, fixed sequences and hardware limit generalization.

## Later boundary and ownership checks

Subsequent reviews added pre-transfer capacity checks and intrinsic TypedArray/stream validation, with getters, subclasses, offsets, failed updates and ref retention regressions. Earlier Linux-regeneration and detailed timing records were not automatically rerun or relabeled after every boundary change.

On 2026-10-22, Release-Asset ownership separation was checked locally with a Release-shaped bundle: Node 22/24 each 121 tests, browser 57, fixtures 3,168, harness 13, demo unit 10, dev 1 and E2E 40 passed. These counts remain historical. Explicit development bundles were not claimed to be published Assets. Actual tag publication, platform CI and Pages delivery require their own hosted evidence.

The maintained [runtime contract](spec/runtime.md), [validation rules](spec/validation.md) and root workflows define current acceptance. Mobile profiles and synthetic IME tests are emulator-level coverage, not physical-device guarantees. No npm publication is planned.
