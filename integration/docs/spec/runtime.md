# Current runtime and publication contract

[日本語](../ja/spec/runtime.md)

Rust asearch-index owns ASIX v1 validation, descriptors and normalization. Asearch-builder generates canonical base/delta bytes without constructing a search engine. Asearch-engine loads/searches segments and optionally enables native builder conveniences. Default WASM disables that feature and does not depend on builder or analyzer. Asearch-analyzer performs server-only Sudachi analysis and query-table export through the CLI.

Browser/Node WASM exposes AsearchIndex.fromBytes/fromStream, search, sessions, explain and atomic segment adoption. Runtime fromDocs/fromStrings/buildIndex/buildDelta/toBytes are absent. IntentIndex's separate bounded DAG construction remains supported. The [API reference](api.md) and package README describe this supported surface.

Regression setup invokes the verified Release CLI. Node adapters and loopback browser fixtures reside in tests/fixtures and are excluded from packed distributions. Loading, searching, disposal, validation and updates still use the actual read-only WASM. Serializer assertions test the server implementation.

ASIX major 1/minor 0 remains unchanged. A pre-separation golden segment and all profiles/64 normalization settings guard compatibility. CLI build-flat accepts bounded UTF-16 columns and version-1 numeric configuration for fixtures/server adapters; ordinary applications use JSONL build/delta. CLI search/compaction/manifest reads the ASIX descriptors: code-point uses Ideal queries; UTF-16 uses asearch.ts-lib. Encoding and size calculation enforce text/unit/file limits.

Client timing covers load, search and update. Server fixture construction and compaction occur outside those intervals. Loopback fixture servers cap JSON at 64 MiB, returning 413 for excess, 400 for malformed requests and 422 for builder failures without terminating the server.

Rust 0.3+ adds opt-in positional ranking without changing matching acceptance or ASIX bytes. The demo consumes bounded, digest-verified query lookup data generated from the same native analysis snapshot as all publication stages. The browser performs lookup/retry policy, never Sudachi analysis. See the [demo analysis guide](../../../docs/search-analysis.md) for limitations.
