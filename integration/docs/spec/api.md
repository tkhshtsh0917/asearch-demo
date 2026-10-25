# JS/TS API and WASM builds

[日本語](../ja/spec/api.md)

<a id="section-12"></a>

## 12. Runtime API

This is the current API, not a list of future proposals. The [package README](../../packages/asearch-wasm/README.md) and generated TypeScript declarations provide examples and exact types.

<a id="section-12-1"></a>

### 12.1 Compatibility API

`Asearch(pattern,mode?,{profile?})` exposes MAXLENGTH=31, pattern, matchMode and masks with compatible values/enumeration. Default mode is Exact; default profile is asearch.ts. Compatibility accepts primitive strings and actual String objects. `match(text,ambig=0)` retains documented coercions and bounds. `matchLevel(text,maxAmbig=3)` returns the first accepted level or -1; its bound is integer 0..31 for every profile. Non-number maxAmbig is TypeError; noninteger/out-of-range/nonfinite is RangeError. Disposal is checked before argument validation. The pattern bound stays 31 UTF-16 units even for Ideal; generic Rust ScalarWm supports longer inputs separately.

`free()` and `[Symbol.dispose]()` are idempotent. Invalid receivers throw TypeError; use after free reports DISPOSED. Without Symbol.dispose the fallback key is Symbol.for("Symbol.dispose"), without modifying global Symbol. TypeScript disposal syntax needs ESNext.Disposable.

<a id="section-12-2"></a>

### 12.2 Boundary and initialization

JS compiles single-symbol casing candidates `[c,c.toLocaleLowerCase(),c.toUpperCase()]`; Rust validates and matches them. UTF-16 transport preserves lone surrogates and does not use TextEncoder. Native handles are explicitly disposable with finalizer fallback. Input/transport budgets are checked before WASM copies. Caller hooks and callbacks are followed by disposal/reentry checks.

Browser ESM attempts asynchronous initialization; await the exported `ready` or `init()`. Failures keep imports usable and permit a later retry. Node ESM/CJS initialize synchronously. The [compatibility contract](compatibility.md#section-19-5-1) specifies per-attempt promises and conflicting explicit initialization. Browser code does not require process or DOM globals.

<a id="section-12-3"></a>

### 12.3 Immutable indexes and results

| API                                               | Responsibility                                                                      |
| ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| AsearchIndex.fromBytes / fromStream               | Validate and load server ASIX, optionally checking expected descriptors/SRI.        |
| index.search / index.session                      | One-shot or independently budgeted repeated search over shared immutable content.   |
| session.update / reset / free                     | Update input, drop reusable checkpoints or release the session.                     |
| index.explain                                     | Resolve an owned ref to a bounded alignment.                                        |
| index.addSegment / replaceSegments                | Atomically append one segment or adopt a complete replacement column.               |
| index.segments / free                             | Inspect segment metadata or dispose the root and child sessions.                    |
| IntentIndex.fromEntries / search / explain / free | Build bounded intent DAGs, search without expansion, explain and dispose.           |
| diffManifest                                      | Pure validation/comparison; never fetches or changes state.                         |
| mergeResults                                      | Deduplicate compatible streams over a fixed catalog with owner/query-specific refs. |

There is no runtime fromDocs/fromStrings/buildIndex/buildDelta/toBytes or client editing API. Native CLI adapters with those conveniences exist only in test setup and are excluded from packed distributions.

Bulk defaults: Ideal, ja-basic-v1, WildcardSpace, wrap=true, ByLength, limit=30, countTotal=false and engine=auto. Search accepts mode, wrap, maxAmbig, limit, countTotal, engine and ranking. Supported immutable-index engines are auto/transposed-blocked; unsupported options fail. Sessions additionally accept maxCacheBytes, default 32 MiB within the total budget. Zero cache disables checkpoints; auto may still use safe narrowing. Transposed-blocked explicitly selects dense search. Intent accepts auto/dag and does not accept ranking.

Results contain JS-owned ids/levels/refs/orders arrays, length, optional exact minimum-level totals, stats and copy(). Position ranking adds optional starts; the default stable order is unchanged. Totals count distinct live keys independently of limit. Limit zero is valid. Empty queries use the selected matching semantics rather than being silently suppressed by the library. The UI may suppress them itself.

`mergeResults` accepts at most 256 structured-clone-friendly parts over one fixed catalog snapshot, including static Worker partitions or alternate query streams. Query streams use the returned owner to select both the reference and the query for explanation. It snapshots caller properties before validating intrinsic array types/lengths and rank order. Positional parts require starts on every part; mixed modes fail. Output typed arrays are capped at 256 MiB, not the whole JS heap. Deduplication ties use input part/order; refs belong to the part identified by parts[i]. No merged totals are reported. Hosts prevent concurrent shared-buffer mutation. Updating/tombstone columns must stay in one Worker; v1 has no cross-Worker update protocol. Worker creation, messaging, scheduling and rendering belong to hosts.

<a id="section-12-4"></a>

### 12.4 Errors, lifetime and updates

Bulk synchronous methods throw and asynchronous methods reject with stable codes: INVALID_INPUT, INVALID_INDEX, UNSUPPORTED_FORMAT, UNSUPPORTED_OPTION, RESOURCE_LIMIT, INVALID_MANIFEST, CONFLICT, BUSY or DISPOSED. Type failures use TypeError with INVALID_INPUT. Caller getter/policy/stream exceptions propagate unchanged and need not carry a code. Do not machine-parse messages. Compatibility Asearch retains its separate conversion rules.

Keys and order are integers in 0..2^32-1. Source documents require at least one primitive-string text; each original and normalized text must fit 65,535 UTF-16 units. Duplicate document keys fail; text input order matters. Limits and descriptors are validated before allocation, with aggregate root/session/transport/staging accounting.

Only one asynchronous update per root is allowed; a second reports BUSY. Searches continue on the old active state. Failure/cancellation preserves it; free aborts staging and prevents late adoption. Multi-segment manifests require one replaceSegments call for atomic adoption. Successful adoption invalidates all opaque refs and relevant caches while preserving session input/options.

Result arrays survive subsequent calls, adoption and free; copy() independently clones arrays and stats. Refs remain root/generation-specific and cannot be reused across roots or Workers. Stale/foreign refs fail INVALID_INPUT. Ref identifiers never silently wrap; exhaustion is RESOURCE_LIMIT. Root disposal invalidates child sessions.

<a id="section-13"></a>

## 13. WASM build

Rust Release CI builds baseline WASM. The demo verifies pinned Assets and runs wasm-bindgen followed by wasm-opt -O3. wasm-bindgen-cli matches Rust Cargo.lock; wasm-pack is unnecessary. No SIMD/Myers/OSA runtime artifact is selected. Rust release settings use opt-level=3, fat LTO, one codegen unit, abort panic and stripped debug information. Core Rust forbids unsafe code and decodes checked little-endian slices explicitly.

The default Rust allocator is retained. Prepared native matching avoids hot-path allocation; boundary result copies, DAG construction, updates and explanations have their own budgets. Raw/gzip/Brotli size and controlled timing are distinct metrics. Biome, rustfmt/Clippy, type checks, tests and docs checks remain separate commands; unchanged upstream originals are never batch-formatted.
