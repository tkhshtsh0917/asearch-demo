# Search corpus

[日本語](ja/data.md)

## Sources and extraction scope

- Title: AutoWikiQA.
- Creators: CL Research Group in Nagoya, Japan / AutoWikiQA contributors.
- Distributor: [cl-nagoya/auto-wiki-qa](https://huggingface.co/datasets/cl-nagoya/auto-wiki-qa).
- Upstream: [hpprc/jawiki](https://huggingface.co/datasets/hpprc/jawiki), Japanese Wikipedia.
- License: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Extracted data retains that license; delivery displays creators, sources, changes and license.

`dataset.lock.json` is authoritative for revision, files, extraction range and hashes. The initial demo deterministically takes the first 10,000 rows of the first shard. It is neither random nor representative. The distributor reports 2,377,503 total rows; whole-corpus scaling and initial-demo transfer sizes are separate concerns.

Only `query` supplies searchable content. `title`, `url` and `passage_id` are retained for attribution; `answer` and `text` are excluded from retrieval. Multiple questions share an article, so `passage_id` is not a unique result key. Keys are physical row numbers in the pinned shard. Expansion to multiple shards needs a deterministic collision-free key scheme.

Processing selects rows and columns and converts them to JSONL. Retrieval does not normalize or rewrite questions. Native Rust analysis adds readings, romanizations and synonyms during indexing; asearch applies search normalization. Display originals and the raw JSONL hash remain unchanged. See [search analysis](search-analysis.md). Generated `attribution.json` also records changes and sources.

The data is machine-generated, and its sources have publication dates. It serves as a search-demo corpus, not a guarantee of correct or current answers.

## Retrieval and validation

[hyparquet](https://github.com/hyparam/hyparquet) retrieves only required rows and columns through HTTP Range. Responses must have exact 206 status, Content-Range, uncompressed transfer and length. Full-shard responses that ignore Range are rejected. Limits are 16 MiB per request, 64 MiB total and 30 seconds per request. Retrieval occurs only during development/builds; visitors do not fetch from Hugging Face.

`fileSha256` is the distributor's original-shard SHA-256; partial retrieval does not verify the whole shard. Ranges use HTTPS URLs at a pinned revision, and the extracted JSONL is checked against `outputSha256`. Row count, empty questions, UTF-16 length, safe integers and Wikipedia source URLs are also validated. Invalid rows fail instead of silently changing counts or keys.

`public/data/` is reproducible and excluded from Git. Pages artifacts contain questions and attribution, also visible in the UI. Indexes and attribution never embed local absolute paths, timestamps or secrets.

## Fixed publication-update scenario

`pnpm build` rechecks the question-output hash and generates base, delta and compacted indexes. Three questions gain the prefix `更新例：`, the fourth is removed, and one synthetic question is added. The effective count stays at 10,000. Raw source JSONL is unchanged. Generation verifies that applying the delta and canonical compaction produce identical bytes.

ASIX, catalogs, manifests and query rules use content-hashed filenames. `release.json` references three stages and their shared query rules. Catalogs and query rules are checked with SHA-256; ASIX uses the manifest's SHA-384 and format metadata. This detects corruption from the same publisher, not publisher identity through signatures. Hosts still need HTTPS and control of the delivery origin.

Published catalogs and indexes retain CC BY-SA 4.0. `release.json` and the UI show creators, source data, pinned revision and changes. Only `public/site/` is Vite's public input; raw build inputs and development files are not served. Redistributed WASM licenses, NOTICE and third-party notices are included under `licenses/`.
