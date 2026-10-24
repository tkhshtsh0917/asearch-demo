# Scope and terminology

[日本語](../ja/spec/scope.md)

<a id="section-0"></a>

## 0. Scope

The goal is fast approximate matching in browser WASM, including loading server-built indexes from a CDN and adopting frequent content updates. Changes must improve matching results or time to results, including load/update costs. UI, scheduling, network transport, caching, personalization and learned ranking belong to hosts.

Rust owns compatibility matching, bulk/session/DAG matching, mechanical normalization, ASIX validation, native building/analysis, base/delta/tombstone updates and server compaction. The TS adapter is DOM-independent and works in Workers. It is locally packed for integration, not published to npm. Browser WASM only loads/searches/adopts indexes. Tokenization, readings, romanization and synonyms run in the separate server-only analyzer; intent generation is not automatic.

The original tuning target was 10^5–10^6 total UTF-16 units, mostly short texts; 10^7 units were a scale probe. Neither is a universal capacity guarantee. Each text must fit 65,535 UTF-16 units before and after normalization. Larger corpora need measured text/unit/working-memory budgets. Browser coverage uses Playwright Chromium, Firefox and WebKit, with mobile profiles; WebKit is not physical Safari and profiles are not OS IME/device verification. Node supports tooling/tests. Deno and edge runtimes are not guaranteed.

<a id="section-1"></a>

## 1. Terms

| Term            | Meaning                                                              |
| --------------- | -------------------------------------------------------------------- |
| pattern         | User search input; the constructor pattern in the compatibility API. |
| text            | Candidate string; the argument called query by upstream match().     |
| symbol          | Unicode code point or UTF-16 unit, according to profile.             |
| m / n           | Non-wildcard pattern length / text symbol count.                     |
| position i      | Pattern prefix length 0..m; bit i means i symbols consumed.          |
| level e / K     | Edit level / maximum accepted edit level.                            |
| LOOPS           | Positions with zero-cost symbol-skipping self-loops.                 |
| EQ_i(x)         | Whether text symbol x belongs to pattern position i's key class.     |
| cost / level(t) | Ideal cost / first matching level within K.                          |
| key             | Stable u32 document ID; update, deletion and deduplication unit.     |
| order           | u32 rank key, lower first; defaults to key.                          |
| segment         | Immutable server-built ASIX file.                                    |
| tombstone       | A key invalidating occurrences in older segments.                    |

<a id="section-17"></a>

## 17. Decisions

[Decisions](../DECISIONS.md) records adopted choices. [Runtime](runtime.md) specifies current APIs. Host query lookup policy and opt-in position ranking do not introduce client editing or learned relevance.
