# Normalization, ranking and ambiguity policy

[日本語](../ja/spec/normalization.md)

<a id="section-8"></a>

## 8. Normalization

Compatibility `Asearch` never normalizes. Bulk indexes, sessions and IntentIndex default to `ja-basic-v1` options 1–5 below; option 6 is off. With normalizer none and matching profile/mode/wrap, bulk levels equal the first accepted compatibility level in 0..K, not necessarily one call to match(text,K).

Rust uses the same mechanical normalization for server indexing and WASM queries. ASIX records `(id,version,options)`; incompatible descriptors are rejected. None accepts `(0,1,0)`; ja-basic accepts `(1,1,0..63)`. Unknown versions and invalid options are distinguished. Transformations are individually selectable:

1. U+3000 → U+0020, including WildcardSpace interpretation.
2. Fullwidth ASCII U+FF01–FF5E → U+0021–007E.
3. Halfwidth kana U+FF61–FF9F → fullwidth; combine an immediately following halfwidth voiced/semi-voiced mark where supported, e.g. ｶﾞ→ガ, ﾊﾟ→パ, ｳﾞ→ヴ.
4. Katakana U+30A1–30F6 → hiragana by subtracting 0x60.
5. ASCII uppercase → lowercase on both sides.
6. Optional long-mark/dash unification: ー／ｰ／－／‐／―／−／ASCII `-` → U+30FC. Including ASCII hyphen keeps combinations with width folding idempotent; default off to preserve model numbers.

Option 3 precedes option 4. ヷ lies outside option 4's range. Existing U+3099/U+309A and other combining sequences do not receive general NFC. The [limited Unicode 17.0.0 tables](../../vendor/unicode/README.md) are not full NFKC; no general NFKC feature is currently provided. Tests cover all units, kana/marks and idempotence under all 64 settings. Lone surrogates are preserved.

`normalize_into` writes without allocating when the caller reserves at least input UTF-16 length. Otherwise it returns NeedsCapacity without changing the previous output. The owning index/workspace accounts for reservations. Normalization may shorten text, so edit costs use normalized symbols; explanation mapping to original UTF-16 is recomputed only for requested results.

<a id="section-9"></a>

## 9. Ranking, deduplication and explanation

Stable order is `(minimum level,order,key)`. Default order is key; immutable segment layout incorporates order so stable extraction uses level buckets without sorting. A key is returned once, selecting the first text at its best distance. Assign separate keys for separate result rows. Rank-only changes are upserts; server compaction can apply large reorderings.

Rust 0.3+ additionally supports `ranking: "position"`: `(minimum level,earliest normalized UTF-16 match start,order,key)`. Every live matching alias participates before top-N; offset 0 beats 1, which beats 2 at equal distance. Equal-distance/start aliases retain input order. Starts with no consumed symbol rank last. The demo enables this for corpus search. See the [ranking contract](https://github.com/tkhshtsh0917/asearch/blob/main/docs/ranking.md) for the budgeted rolling row and ABI.

`explain` uses a separately budgeted traceback matrix, rejecting excess with RESOURCE_LIMIT. Free loops do not highlight. Ties prefer leftmost end, rightmost start, then exact diagonal, substitution, deletion, insertion and free loop. Spans are UTF-16 intervals in an explicit coordinate space. Supplied original text takes precedence and must normalize to the indexed text; otherwise INVALID_INPUT. Stored originals are used when available; normalized-only files return normalized-utf16 rather than inventing original positions. IntentIndex explains the selected expansion. Position ranking does not alter these highlighting ties.

<a id="section-10"></a>

## 10. Ambiguity policy

Preparation order is normalization → mode/profile-aware length → K → wrap → matching. Wrap adds two spaces only in WildcardSpace and does not contribute to K or the external input limit. QueryWorkspace reserves active/staging buffers fallibly, retaining its successful pattern/K if preprocessing fails. Index ownership adds aggregate capacity accounting.

- Default: `byLength({every:4,max:3,unit:"profile",includeWildcards:false})`, giving `min(floor(len/4),3)`.
- `fixed(k)` and numeric maxAmbig use integer K in 0..7. Every must be a positive safe integer. Values are rejected, not rounded. K=0..3 uses specialized kernels; 4..7 uses the generic path. Compatibility match uses its separate bounds.
- Profile length uses that profile's text symbols; code-point and utf16 can be selected explicitly. Lone surrogates count as one. WildcardSpace spaces are excluded by default; Exact/Include literal spaces count. Internal wrap is always excluded.
- Examples: abc → 3/0; abcd → 4/1; ab cd → 4/1; ＡＢＣＤ → 4/1; ｶﾞｷｸｹ → がきくけ → 4/1. 😀😀 gives 2/0 under code-point length and 4/1 under utf16.
- Custom JS policies receive normalized, unwrapped input, mode and profile once per search/update. Their result must be integer 0..7. Caller exceptions propagate; disposal/reentry is rechecked after callbacks. Callback allocation is outside the prepared Rust kernel's no-allocation claim.

Server-generated query lookup is a separate host policy before these steps; it does not change ja-basic-v1 or ASIX. See the [demo analysis guide](../../../docs/search-analysis.md).
