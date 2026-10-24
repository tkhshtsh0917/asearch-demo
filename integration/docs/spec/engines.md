# Layouts and matching engines

[日本語](../ja/spec/engines.md)

<a id="section-3"></a>

## 3. Corpus representation

<a id="section-3-1"></a>

### 3.1 Symbols

Profiles select code-point or UTF-16 text iteration. Lone surrogates retain their code-unit values. Query pattern literals are compiled once with original/lower/upper keys, then resolved to dense corpus IDs. ID zero denotes an absent symbol, never a match. Native Rust and host JS casing are distinct inputs.

<a id="section-3-2"></a>

### 3.2 Block-aligned slots

Each text has a boundary slot followed by its symbols, with separator/text/end masks and guard/padding slots. Blocks align to u64 words; a long text may require an enlarged block. Canonical order is document order/key then input text order. Runtime block width is not serialized in ASIX. END prefix counts map accepting bits to text IDs.

<a id="section-3-3"></a>

### 3.3 EQ containers

Per-symbol occurrences use u16 offset arrays or dense 65,536-slot chunk bitmaps, with the 4,096-occurrence crossover. A bounded eight-row EQ cache is reused within each block. Repeated literals reuse masks; cache memory does not grow with every distinct query symbol.

<a id="section-4"></a>

## 4. Transposed blocked matching

<a id="section-4-1"></a>

### 4.1 Orientation

Classic Bitap assigns bits to pattern positions and iterates text symbols. This engine assigns bits to corpus slots and iterates pattern rows. S[i][e] represents all slots whose prefix cost is at most e. Bulk matching uses Ideal monotonic costs; profile differences select text units, not nonmonotonic acceptance.

<a id="section-4-2"></a>

### 4.2 Recurrence

sh moves toward increasing slots with cross-word carry. SEP resets text boundaries and TXT restricts fill to text slots. The formulas below use multiword shifts/addition and the monotonic initial boundary i<=e.

```text
row 0: X = e>0 ? sh(S[0][e-1]) : 0
row i: X = (sh(S[i-1][e]) & EQ_i)
         | (e>0 ? sh(S[i-1][e-1]) | S[i-1][e-1] | sh(S[i][e-1]) : 0)
X = (X & ~SEP) | (i<=e ? SEP : 0)
S[i][e] = i in LOOPS ? fill(X) : X
accept at text k iff END_k is set in S[m][e]

y = (x & TXT) | (sh(x & SEP) & TXT)
f = (((y + TXT) ^ TXT) & TXT) | y
fill(x) = f | (x & SEP)
```

<a id="section-4-3"></a>

### 4.3 Free-loop fill

The carry trick fills from a reachable text slot to that text's end. Boundaries, dead padding and guards absorb carry, preventing one text from matching through another. Cross-word arithmetic is tested at long-text and block edges.

<a id="section-4-4"></a>

### 4.4 Extraction

The engine records minimum levels for every matching text. Extraction visits every relevant alias, chooses each live document's best hit and counts distinct keys. Stable extraction emits level buckets in canonical document order. Position ranking computes starts for all live matches, sorts the complete document candidates and only then truncates. Dead rows may still be captured for safe planner bookkeeping but never become live hits. Counts are not raw text popcounts and are independent of top-N. Segment merging uses the same comparator.

<a id="section-4-5"></a>

### 4.5 Block execution

Two rolling state buffers hold each block's rows. If the maximum-level row is empty after boundary initialization can no longer revive it, that block exits early. K=0..3 is specialized; K=4..7 uses a dynamic loop. Workspaces validate ownership, capacities and descriptors before use. Prepared native matching performs no heap allocation; transport/output copies are separate.

<a id="section-4-6"></a>

### 4.6 Optional engines

OSA, Myers, SIMD and NodeAsearch are not selectable runtime engines. Do not add their proposed terms to this recurrence or advertise them as implemented. Adoption requires independent equivalence and controlled measurements.

<a id="section-4-7"></a>

### 4.7 Incremental rows

SearchSession keeps bounded checkpoints for normalized common-prefix rows. Changes in classes, mode, wrap or K use validated reuse/fallback conditions. Evicted or unavailable checkpoints safely return to blocked computation. Cache reservations are shared with all root/session/segment capacities; query length does not cause unbounded retained state.

<a id="section-5"></a>

## 5. Scalar matching

ScalarWm supports generic word widths and reusable workspaces for native matching. The compatibility path separately retains wrapping u32 semantics. Small complete candidate sets use a bounded bit-parallel kernel up to 63 literals, otherwise rolling scalar DP. Complete key-class masks are resolved before scanning; NUL, non-BMP and lone surrogates are regression cases.

<a id="section-6"></a>

## 6. Safe narrowing

<a id="section-6-1"></a>

### 6.1 Preconditions

Narrowing uses the complete previous matching-text set, including aliases outside top-N. It requires a proven literal extension, compatible loop/mode/classes and no K increase. Backspace, changed normalization/casing, unsafe wildcard edits or larger K trigger a safe broader search. Truncated/overflowed candidate capture is never treated as complete.

<a id="section-6-2"></a>

### 6.2 Planner

A conservative cost comparison uses total candidate units against the dense corpus path. Only sufficiently small complete candidate sets use scalar evaluation; otherwise blocked/incremental matching remains active. Auto and explicit transposed-blocked differ in planning, not matching results. maxCacheBytes=0 disables checkpoints but does not prohibit separately budgeted narrowing.

<a id="section-7"></a>

## 7. Intent DAG

<a id="section-7-1"></a>

### 7.1 Grammar and bounds

Support literals, grouping, alternation, optional previous atoms and backslash escaping. Reject star/plus cycles and malformed expressions. For example, `(保存|更新)(する)?`. Recursive descent follows explicit groups only, capped at depth 64. Raw expressions are at most 65,535 UTF-16 units; node/edge/normalization-state quotas and the working budget are checked before growth.

<a id="section-7-2"></a>

### 7.2 Matching

The current implementation uses a minimum-cost DAG-by-pattern matrix, with entry exclusion from minimum/maximum symbol lengths. Normalization and surrogate handling preserve finite pending state across grammar boundaries. It does not enumerate the exponential set of strings and never silently truncates it. A proposed state-word OR merger is not the current runtime algorithm. Small full-expansion oracles and exponential-choice tests validate equivalence.

<a id="section-7-3"></a>

### 7.3 Explanation

For requested hits, bounded traceback reconstructs an actual best expansion and its highlight spans. Original coordinates are returned only when the selected pre-normalized expansion can be recovered; otherwise the coordinate space is explicitly normalized. IntentIndex uses its own stable ranking and does not support positional ranking or segment deltas.
