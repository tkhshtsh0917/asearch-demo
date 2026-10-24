# Specifications

[日本語](../ja/spec/README.md)

The [runtime contract](runtime.md) defines the current supported surface. These documents retain numeric section anchors so existing references remain usable. Older milestone reports are dated evidence, not additional APIs.

| Sections | Document                                                |
| -------- | ------------------------------------------------------- |
| 0, 1, 17 | [Scope and terminology](scope.md)                       |
| 2        | [Matching semantics](semantics.md)                      |
| 3–7      | [Layouts and engines](engines.md)                       |
| 8–10     | [Normalization, ranking and policies](normalization.md) |
| 11, 20   | [Index format and updates](index-format.md)             |
| 12–13    | [JS/TS APIs and WASM builds](api.md)                    |
| 14–15    | [Validation and measurement](validation.md)             |
| 16, 18   | [Rationale and references](rationale.md)                |
| 19       | [Compatibility boundary](compatibility.md)              |

The Rust repository maintains [architecture diagrams](https://github.com/tkhshtsh0917/asearch/blob/main/docs/architecture.md), [Bitap animations](https://github.com/tkhshtsh0917/asearch/blob/main/docs/algorithm.md) and [ASIX byte layouts](https://github.com/tkhshtsh0917/asearch/blob/main/docs/asix-format.md). `crates/` refers to that Rust repository; `packages/`, `tools/` and `vendor/` refer to this workspace. See [milestones](../PLAN.md), [decisions](../DECISIONS.md) and [build instructions](../../README.md).
