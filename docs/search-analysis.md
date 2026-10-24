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

ASIX v1 already supports multiple `texts` for a document. This feature changes neither the binary format nor the WASM API. The engine selects the best matching text and deduplicates hits by key. Base generation, atomic upserts/removals and canonical compaction use exactly the same analyzed documents; replacing a document removes its old alternatives.

The UI always displays the catalog question. If a different text matched, it displays a separate **検索用表現** line with that text's own highlight spans. Alias offsets are never applied to the original question. IME `input` events also search uncommitted text; commit and cancellation schedule the final input value without modifying the input or its selection.

The default application limits are 256 synonym texts per question and 131,072 UTF-16 units per document. Set either `maxSynonymTexts` or `maxDocumentUnits` to `-1` in `policy.json` to disable that application limit. ASIX still limits each text to 65,535 units. The demo caps analysis input/output at 16/64 MiB, 20,000 records and 120 seconds per subprocess; the native CLI independently caps JSONL input at 64 MiB and 1 MiB per line. Native CLI limits and the existing Worker memory/query limits remain enforced. No cap silently truncates alternatives.

## Reproduction and provenance

After the [normal setup](../README.md), prepare the offline build environment:

```sh
mise exec -- pnpm analysis:prepare
mise exec -- pnpm analysis:test
BASE_PATH=/asearch-demo/ mise exec -- pnpm build
```

`analysis:prepare` downloads checksum-verified dictionary, filter, synonym and license resources, then invokes the Rust resource converter. It requires `unzip` and a released CLI with analyzer support (v0.2.0 or newer). Subsequent analysis runs offline. The large system dictionary is memory-mapped by Sudachi and cached under its content hash; mapped files are immutable. Compiled stop/synonym JSON is loaded into owned Rust collections without another mmap layer.

Run `mise exec -- pnpm analysis:update` to resolve the current `develop` heads of SudachiDict and elasticsearch-sudachi, fetch all three text resources and their notices, validate Rust conversion, update `resources.lock.json` and prepare them. Review and commit the pin changes. Ordinary builds never silently resolve latest upstream. The system-dictionary binary version is a separate fixed pin; text updates do not silently replace that much larger binary.

For explicit testing before a Rust release, `ASEARCH_ANALYZER_CLI` can name a locally built native CLI. It is never an implicit sibling checkout; its SHA-256 is recorded. CI uses the verified CLI from Release Assets. The unmodified `public/data/questions.jsonl` keeps its dataset hash; `documents.jsonl` remains a raw-question CLI example. The publication step generates the enriched ASIX separately.

`data/analysis.json` in the built site records the synonym revision, byte counts, SHA-256 hashes, filtering policy, compiled-resource SHA and native analyzer executable SHA. License and legal notices accompany the derived data under `licenses/SudachiDict-LICENSE-2.0.txt` and `licenses/SudachiDict-LEGAL`; filter-source notices are in `licenses/elasticsearch-sudachi-LICENSE`. See [data attribution](data.md) for AutoWikiQA's separate CC BY-SA 4.0 requirements.

Real-dictionary regression tests cover both directions of the Beatles example, expansion flags, filtering, unlimited soft limits, ASIX loading, delta invalidation and compaction. Playwright covers the seven query spellings, original-question display and synthetic IME events in three browser engines and mobile profiles. These profiles do not verify a physical device or an OS IME.
