# Index format and server updates

[日本語](../ja/spec/index-format.md)

<a id="section-11"></a>

## 11. ASIX v1 and delivery

The Rust repository's [byte-level specification](https://github.com/tkhshtsh0917/asearch/blob/main/docs/asix-format.md) is authoritative for header offsets, section entries, payload types and checksums. Major 1/minor 0 is unchanged by crate separation, native analysis or query lookup.

<a id="section-11-1"></a>

### 11.1 Stored versus derived data

One file is one immutable segment. Store normalized UTF-16 text, lengths, keys, order and optional tombstones/originals. Build symbol IDs, block layout, separator/text/end masks and EQ containers at load time. This keeps document changes local and removes runtime block widths and absolute derived offsets from the wire format. Normalized-only files never invent originals.

<a id="section-11-2"></a>

### 11.2 Canonical layout

Writers produce TEXT/TLEN/KEYS/ORDR, optional OLEN/OTXT and optional sorted unique TOMB. Sections are explicitly decoded little-endian; no typed pointer casts. The canonical writer is deterministic. Original normalization must match stored normalized text.

<a id="section-11-3"></a>

### 11.3 Ordering

Documents are canonicalized by order/key; text order within a document is retained. Duplicate document keys fail. Server builds and compaction use the same canonical serialization. Derived search structures do not enter output bytes.

<a id="section-11-4"></a>

### 11.4 Loading

Validate lengths, offsets, alignment, section tags/duplicates, reserved fields, descriptors, ordering, checksums and resource limits before adoption. Unknown critical sections fail; validated noncritical sections may be skipped and are not preserved by reserialization. Stream loading reads the bounded header first, rejects truncation/extra bytes, refreshes memory views after awaits and releases failed readers/staging.

<a id="section-11-5"></a>

### 11.5 Compatibility

Readers reject unsupported format/normalizer versions rather than guessing. The same supported settings and document set produce byte-identical canonical output. A pre-split golden segment and all profiles/64 normalization settings guard compatibility. Byte hashes detect corruption; trusted delivery is a separate concern.

<a id="section-11-6"></a>

### 11.6 Resource limits

| Default         | Value      |
| --------------- | ---------- |
| maxTotalBytes   | 256 MiB    |
| maxTexts        | 1,000,000  |
| maxUnits        | 10,000,000 |
| maxSlots        | 16,777,216 |
| maxWorkingBytes | 512 MiB    |
| maxPatternUnits | 65,535     |
| maxSegments     | 8          |

Limits must be positive safe integers; maxSegments is at most eight. Hosts may lower them. Per-text original and normalized UTF-16 length must fit 65,535. Source buffers, decoded/derived storage, query/workspace reservations, transport, staging and old-plus-new transitions are accounted according to API ownership. These are configured capacity budgets, not process/browser-RAM guarantees. Failures never silently truncate or partially adopt. The demo uses stricter query and working limits.

<a id="section-20"></a>

## 20. Server-published segments

<a id="section-20-1"></a>

### 20.1 Update choices

Small or infrequent datasets may replace a base. Frequent updates can append deltas and periodically compact. Choose thresholds from measured transfer, load, search and transition costs; the engine does not run a scheduler.

<a id="section-20-2"></a>

### 20.2 Document changes

An upsert contains the complete replacement texts/order and invalidates older occurrences of its key. Removal emits a tombstone. A segment's tombstone affects older segments, never its own replacement texts. A document's alternatives share one key. Rank-only changes are upserts. No client overlay is involved.

<a id="section-20-3"></a>

### 20.3 Search and merge

Live masks resolve newest-key ownership before searching. Minimum distance is computed across each live document's aliases. Segment results merge with identical ranking and deduplicate live keys before top-N. Minimum-level totals are exact and independent of the requested limit. Position ranking uses the same start comparator in every segment and in the final merge.

<a id="section-20-4"></a>

### 20.4 Atomic adoption

Stage and validate all candidate bytes/descriptors within aggregate limits. Only a successful complete adoption replaces active state, increments its revision and invalidates refs/caches. Searches can use the old state while staging. Failure, cancellation or disposal cannot publish a partial column. replaceSegments is required for atomic multi-part adoption; repeated addSegment calls are not one transaction.

<a id="section-20-5"></a>

### 20.5 Manifests and compaction

A manifest has format asearch-manifest/1, indexId, generation, immutable index descriptors and an ordered segment list. IndexId matches `[A-Za-z0-9][A-Za-z0-9._-]{0,127}`; generation is a positive safe integer. Changing normalization/format/symbol units requires a new series and explicit new index, not silent session migration. Segment count is 1..8, including a zero-text base for an empty corpus.

Each descriptor contains lowercase 16-digit XXH3 id, URL, byte count, text count and SHA-384 SRI. URLs are nonempty HTTP(S) absolute/relative references without userinfo; resolution, origin/CORS and retrieval are host responsibilities. expected verifies actual bytes/texts/id and full SHA-384 before adoption. XXH3 is not cryptographic authenticity; the host must trust the manifest and transport.

`diffManifest` validates both inputs before comparison. Without current it returns replace. Different series/configuration conflicts; older generation is stale. Equal generation requires identical regulated fields, ignoring JSON object key order but preserving segment order. A newer generation may relocate a URL but cannot redefine known id/bytes/texts/integrity. An exact old-ID prefix returns append (or none if unchanged); otherwise replace.

Hosts serialize diff → load → adopt → save applied full manifest. Update current only after successful atomic adoption; save new generations even for none. Failure preserves current for retry. Generation exhaustion never wraps.

The native CLI provides JSONL build/delta, manifest generation and compaction. Upsert input is `{"op":"upsert","key":1,"texts":["updated"]}`; removal is `{"op":"remove","key":1}`. These are server builder operations, not browser editing APIs. Compaction must equal a canonical build of the effective live documents. Browser WASM has no builder or compactor.

<a id="section-20-6"></a>

### 20.6 Delivery recommendations

Use content-hashed immutable segment URLs and short-lived/revalidated manifests. Configure and test HTTP compression at the CDN/server; the CLI emits ASIX bytes, not compressed dictionaries or CDN settings. The loader validates the decoded body length. Fetching, polling, push notifications and offline persistence belong to hosts.

<a id="section-20-7"></a>

### 20.7 Memory

WASM linear memory does not shrink. Full replacement can keep old/new indexes and staging live together; do not equate the capacity budget to total browser RAM or a fixed two-times peak. Replacing a Worker can reclaim its entire WASM instance when appropriate. Delta adoption usually transfers less but still needs measured headroom.

<a id="section-20-8"></a>

### 20.8 Exclusions

No browser editing overlay/upsert/remove/forget APIs, IntentIndex delta protocol, cross-Worker tombstone protocol, built-in manifest networking, persistent cache or CDN configuration is provided.
