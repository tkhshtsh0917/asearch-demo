# Current runtime and publication contract

Rust `asearch-index` owns ASIX v1 validation, descriptors and normalization. `asearch-builder` generates canonical base/delta bytes without constructing a search engine. `asearch-engine` loads and searches segments; its optional `builder` feature retains native serialization conveniences. The default WASM build disables that feature and does not depend on the builder crate.

The CLI builds, compacts and publishes segments. The browser and Node WASM API expose `AsearchIndex.fromBytes/fromStream`, search, sessions, explain and atomic segment adoption. `fromDocs`, `fromStrings`, `buildIndex`, `buildDelta` and `toBytes` are absent from the runtime API. IntentIndex's separate DAG construction API remains supported.

Regression setup invokes the verified Release CLI. Node adapters live in `tests/fixtures`; the loopback browser harness prepares fixture bytes through the same CLI. These adapters are excluded from the packed distribution. Tests still use the actual read-only WASM for loading, searching, disposal, input validation and updates. Serializer assertions concern the server implementation.

The historical API proposals in api.md and M0 compatibility.md are design records. This contract and the package README define the currently supported surface.

ASIX major 1/minor 0 is unchanged. A golden segment generated before crate separation and all profiles/64 normalization settings test byte compatibility. CLI `build-flat INPUT_JSON OUTPUT_ASIX` accepts bounded UTF-16 columns and a version-1 numeric config for fixtures/server adapters; ordinary applications should use JSONL `build` and `delta`.

Client benchmarks time load, search and update only. Server fixture creation and compaction run outside those intervals; they are not browser compaction measurements.

CLI search, compaction and manifest publication read the ASIX symbol unit and normalizer descriptors. Code-point segments use the Ideal query profile; UTF-16 segments use asearch.ts-lib. Public Rust encoding and size calculation enforce text/unit limits as well as file size limits.

Loopback fixture servers accept at most 64 MiB of JSON, matching the CLI input ceiling. Oversized requests return 413, malformed requests return 400, and builder failures return 422 without terminating the server. Fixture generation is outside client timing intervals.
