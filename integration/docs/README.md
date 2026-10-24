# Integration documentation

[日本語](ja/README.md)

This workspace documents the TypeScript boundary consuming Rust Release Assets. The [current runtime contract](spec/runtime.md) and [package README](../packages/asearch-wasm/README.md) describe supported APIs.

| Topic                                   | Entry                                           |
| --------------------------------------- | ----------------------------------------------- |
| Ownership and dependencies              | [Repository layout](repository-layout.md)       |
| Build, use and validate                 | [Root README](../README.md)                     |
| Matching, indexes and runtime APIs      | [Specifications](spec/README.md)                |
| Adopted choices                         | [Decisions](DECISIONS.md)                       |
| Independent correctness models          | [Reference tools](../tools/reference/README.md) |
| Upstream originals, licenses and hashes | [Vendor](../vendor/README.md)                   |

`docs/` contains Markdown explanations and specifications. Rust sources live in the Rust repository's `crates/`; executable integration code lives in `packages/` and `tools/`; unchanged upstream material lives in `vendor/`. Upstream code is test input, not product implementation. English is authoritative; Japanese counterparts translate the same content. Update both in one change.
