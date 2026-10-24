# Server-side search analysis

[日本語版](ja/search-analysis.md)

The displayed question and the searchable texts are separate resources. A stable document key links the unchanged question in the catalog to several search-only texts in ASIX v1. A match on any alternative returns the same question once. Article titles and answers are not added to the search corpus.

```text
AutoWikiQA question ──────────────────────────> display catalog
       │                                             │ key
       └─> Sudachi + filtering + synonyms + romaji ─> texts[]
                                                       │
                                                released Rust CLI
                                                       │
                                                   ASIX v1
                                                       │
                                         read-only WASM in a Worker
```

## Generated representations

The Rust CLI and its server-only `asearch-analyzer` crate perform tokenization, filtering, synonym expansion and romanization. `tools/analysis` handles network retrieval, pinned resources and CLI orchestration. The system dictionary is SudachiDict-core 20261015; kana romanization uses Rust wana_kana 5.0.0. Sudachi, its dictionaries and the romanizer are not shipped to the browser; the browser performs existing Rust normalization and matching only.

Each document contains its original question first, then nonempty, deduplicated alternatives:

1. Space-separated normalized content words.
2. Space-separated katakana readings of those words.
3. Romanized readings with repeated long vowels, such as `biitoruzu`.
4. Romanized readings with an explicit `-` for a katakana long mark, such as `bi-toruzu`.
5. Independent synonym terms produced from eligible tokens. These avoid duplicating the entire question for every alternative; keywords across separate texts are not combined.

The existing `ja-basic-v1` descriptor handles ASCII case, width and hiragana/katakana differences. `Beatles` is an English name, not a romanization of ビートルズ. The pinned SudachiDict group 007475 supplies `ビートルズ`, `Beatles` and `The Beatles`. Together these paths cover `ビートルズ`, `びーとるず`, `Beatles`, `BEATLES`, `beatles`, `biitoruzu` and `bi-toruzu` for the covered questions.

## Filtering and synonym direction

`tools/analysis/policy.json` selects Sudachi split mode C. It retains nouns, verbs, adjectives and na-adjectives (`名詞`, `動詞`, `形容詞`, `形状詞`). Stopwords and stoptags come from the pinned elasticsearch-sudachi resources. Stoptags match hierarchical POS component prefixes; stopwords match lowercased token surface, normalized or dictionary forms. Filtering changes the generated keyword/readings and eligibility for synonym expansion; it never removes words from the original question.

These settings are application policy, not universal Japanese relevance rules. Pronouns, particles and auxiliaries still occur in the original searchable question. Filtered alternatives can broaden matches and lose distinctions such as negation. They do not establish semantic equivalence or provide BM25/field-weighted ranking. Evaluate relevance before adapting the policy to another corpus.

The [SudachiDict synonym source](https://github.com/WorksApplications/SudachiDict/blob/830bf9e1313f6f75235ba87ee041e144dbcad8c1/src/main/text/synonyms.txt) is pinned to revision `830bf9e1313f6f75235ba87ee041e144dbcad8c1`. Its [CSV specification](https://github.com/WorksApplications/SudachiDict/blob/830bf9e1313f6f75235ba87ee041e144dbcad8c1/docs/synonyms.md) defines expansion control:

| Flag        | Behavior                                       |
| ----------- | ---------------------------------------------- |
| empty / `0` | May trigger its group and be emitted.          |
| `1`         | May be emitted, but cannot trigger that group. |
| `2`         | Cannot trigger or be emitted.                  |

Lookup uses exact surface/normalized/dictionary forms of eligible Sudachi tokens, with lowercased heading lookup. It is one-hop, does not recursively expand results, and does not enumerate combinations of synonyms. A multi-token heading may be emitted from an eligible trigger but is not independently detected across token boundaries. Dictionary domain labels do not perform word-sense disambiguation. Neither every possible romanization nor every synonym in natural language is guaranteed.

## Format, display and resource bounds

ASIX v1 already supports multiple `texts` for a document. Auxiliary texts do not change the binary format. Query lookup uses a separate asset; optional positional ranking extends the runtime boundary as described below. The engine selects the best matching text and deduplicates hits by key. Base generation, atomic upserts/removals and canonical compaction use exactly the same analyzed documents; replacing a document removes its old alternatives.

The UI always displays the catalog question. If a different text matched, it displays a separate **検索用表現** line with that text's own highlight spans. Alias offsets are never applied to the original question. IME `input` events also search uncommitted text; commit and cancellation schedule the final input value without modifying the input or its selection.

The demo separates content updates from index consolidation. Select the `更新例` query example: it returns zero questions initially and four after applying the delta (three changed questions and one added question; a separate question is removed). Added and changed questions carry text badges and distinct colors, derived from catalog records after successful adoption. Those badges remain relative to the initial catalog after compaction, while the index file count changes from two to one. Intent-mode results do not receive corpus update badges. Compaction loads a prebuilt single index with the same effective search content.

The **差分前に戻す** button atomically restores the initial index and catalog without restarting the Worker or changing the input. It clears update labels and allows the delta to be applied again. Failed restoration preserves the current results. Search epochs increase independently of the displayed stage, so results from an earlier adoption cannot overwrite the restored view.

The default application limits are 256 synonym texts per question and 131,072 UTF-16 units per document. Set either `maxSynonymTexts` or `maxDocumentUnits` to `-1` in `policy.json` to disable that application limit. ASIX still limits each text to 65,535 units. The demo caps analysis input/output at 16/64 MiB, 20,000 records and 120 seconds per subprocess; the native CLI independently caps JSONL input at 64 MiB and 1 MiB per line. Native CLI limits and the existing Worker memory/query limits remain enforced. No cap silently truncates alternatives.

The synonym quota counts only unique texts added after the original, normalized words, reading and romanizations. Repeated dictionary entries and synonyms identical to those basic forms spend no synonym quota; the document unit budget counts all final texts once.

Sudachi additionally limits the source to 49,149 UTF-8 bytes before its input plugins and the rewritten input to 65,535 UTF-8 bytes. These byte limits are separate from ASIX UTF-16 units and remain active with `-1`. For example, 16,384 copies of `あ` exceed the source byte limit. Input normalization can expand a shorter source past the rewritten-input limit. Either violation fails without truncation.

## Reproduction and provenance

After the [normal setup](../README.md), prepare the offline build environment:

```sh
mise exec -- pnpm analysis:prepare
mise exec -- pnpm analysis:test
BASE_PATH=/asearch-demo/ mise exec -- pnpm build
```

`analysis:prepare` downloads checksum-verified dictionary, filter, synonym and license resources, then invokes the Rust resource converter. It requires `unzip` and a released CLI with analyzer and query-rule support (v0.3.0 or newer). Subsequent analysis runs offline. The large system dictionary is memory-mapped by Sudachi and cached under its content hash; mapped files are immutable. Compiled stop/synonym JSON is loaded into owned Rust collections without another mmap layer.

Run `mise exec -- pnpm analysis:update` to resolve the current `develop` heads of SudachiDict and elasticsearch-sudachi, fetch all three text resources and their notices, validate Rust conversion, update `resources.lock.json` and prepare them. Review and commit the pin changes. Ordinary builds never silently resolve latest upstream. The system-dictionary binary version is a separate fixed pin; text updates do not silently replace that much larger binary.

For explicit testing before a Rust release, `ASEARCH_ANALYZER_CLI` can name a locally built native CLI. It is never an implicit sibling checkout; its SHA-256 is recorded. CI uses the verified CLI from Release Assets. The unmodified `public/data/questions.jsonl` keeps its dataset hash; `documents.jsonl` remains a raw-question CLI example. The publication step generates the enriched ASIX separately.

Preparation captures the pin file and native executable before conversion, verifies private copies of the source texts, and preserves the previous ready pointer if the pins or executable have changed at its final check. A publication captures one matching ready record, pin file, policy, compiled resources and executable. Its base, delta, compaction and provenance share that generation; CLI calls execute private copies of the captured bytes. Later updates affect the next publication. License selection uses the same captured pins. Keep old content-addressed system dictionaries immutable and present while a captured generation can still run.

`data/analysis.json` in the built site records the synonym revision, byte counts, SHA-256 hashes, filtering policy, compiled-resource SHA and native analyzer executable SHA. License and legal notices accompany the derived data under `licenses/SudachiDict-LICENSE-2.0.txt` and `licenses/SudachiDict-LEGAL`; filter-source notices are in `licenses/elasticsearch-sudachi-LICENSE`. See [data attribution](data.md) for AutoWikiQA's separate CC BY-SA 4.0 requirements.

Real-dictionary regression tests cover both directions of the Beatles example, expansion flags, filtering, unlimited soft limits, ASIX loading, delta invalidation and compaction. Playwright covers the seven query spellings, original-question display and synthetic IME events in three browser engines and mobile profiles. These profiles do not verify a physical device or an OS IME.

## Corpus size and browser budgets

The 2026-10-24 fixed-shard check produced these shapes with the same analysis policy. A searchable text is an original or auxiliary string, not a morpheme token or a result document.

| Questions | Searchable texts | Base ASIX bytes | gzip-9 bytes |
| --------- | ---------------- | --------------- | ------------ |
| 10,000    | 120,629          | 8,454,336       | 2,534,502    |
| 50,000    | 574,363          | 40,632,640      | 12,554,444   |

gzip-9 is an offline size measurement; it does not assert that a CDN serves these files with that encoding.

For 50k, the read-only WASM kernel rejected 64/128 MiB working budgets and loaded/searched successfully at 256 MiB in Chromium, Firefox and WebKit. This is a configured Rust resource budget, not total browser RAM usage. The comparison used released WASM v0.1.0 and the v0.2.0 analyzer source, demonstrating ASIX v1 compatibility.

The production demo remains at 10k. Its ingestion cap, 20k catalog validation, 8 MiB catalog transfer limit and generation-transition headroom need separate evaluation before increasing that setting. The 50k kernel probe does not establish a 50k UI or mobile-memory guarantee. Server analysis can be batched: the probe combined 20k/20k/10k invocations before building one ASIX. Earlier tuning measurements use their recorded index shapes and do not automatically describe these expanded corpora.

## Query-only lookup and ranking (Rust 0.3+)

Publication uses the same captured native analyzer to export one `asearch-query-rules/1` JSON asset, shared by base, delta and compacted stages. `release.json` names the immutable file and its SHA-256. The Worker verifies at most 2 MiB before readiness; no Sudachi dictionary is shipped to the browser.

The server exports only unambiguous verb/adjective inflections whose normalized forms occur in the filtered corpus. The browser performs one exact lookup per standalone or whitespace-delimited query term: `食べた`, `食べました` and `食べる` therefore search the same canonical query. Unknown and ambiguous forms remain literal. This is not sentence segmentation; arbitrary unsegmented sentences, negatives and substrings inside nouns are not rewritten. Limits are 50,000 form rules, 8,192 kana rules and 128 UTF-16 units per query/form, independently of the synonym policy's `-1` options.

Only after the effective query returns zero hits, a bounded longest-match kana table retries mixed IME input such as `びーt` → `bi-t`. Original matches win, and input text/selection are preserved. Lookup data comes from the server's pinned wana_kana implementation, including apostrophes such as `んあ` → `n'a`; its MIT notice is distributed as `licenses/wana_kana-MIT.txt`. Oversized rewrites are not retried.

Corpus searches opt into Rust's global `(minimum edit distance, earliest normalized UTF-16 start, order, key)` ranking. Every live matching alias participates before top-N, so prefix matches outrank later substring matches at the same distance; offset 1 also outranks offset 2. Intent mode retains its existing order. See the [ranking contract](https://github.com/tkhshtsh0917/asearch/blob/main/docs/ranking.md). This adds positional DP and sorting work; earlier performance measurements do not include it.

These features require CLI and WASM 0.3 or newer. Until that release is published, use explicitly supplied development artifacts for local verification; do not fabricate checksums for unpublished assets or mistake local verification for a Pages deployment.
