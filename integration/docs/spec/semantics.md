# Matching semantics

[日本語](../ja/spec/semantics.md)

<a id="section-2"></a>

## 2. Reference semantics

The compatibility baseline is the vendored source and published lib of asearch.ts 1.0.3. The current read-only runtime and bulk API are specified separately in [runtime](runtime.md).

<a id="section-2-1"></a>

### 2.1 Public shape

Upstream exports Asearch and a numeric, reverse-mapped MatchMode enum: Exact=0, Include=1, WildcardSpace=2. Asearch exposes MAXLENGTH=31, matchMode, pattern and signed-int32 masks. Observable own fields are ordered loopMask, masks, matchMode, pattern, initPattern, acceptPattern; verbose() is a prototype method. Upstream declarations have private members, so compatibility is measured against the public surface, not nominal assignment to its private class type.

<a id="section-2-2"></a>

### 2.2 Pattern compilation

Reject patterns longer than 31 UTF-16 units, including spaces. Array.from splits the pattern into code points. INIT is unsigned bit 31; accept starts at INIT shifted right by pattern symbol count. Include adds initial/accepting free loops. WildcardSpace turns each U+0020 into a free loop at its preceding position and removes that space from the accepting position. Exact and unknown compatibility modes have no free loops.

Only pattern-side case candidates are expanded: original, locale lowercase and uppercase. Multi-symbol expansions such as ß→SS cannot match one text symbol. Host JS casing is used for compatibility; native Rust casing can differ by locale.

<a id="section-2-3"></a>

### 2.3 Symbol transitions

```text
states[e] = INIT >>> e                     for e = 0..ambig
for each text symbol x:
  mk = masks[x] ?? 0
  for e = ambig .. 1:
    states[e] = (states[e] & loop) | ((states[e] & mk) >>> 1)
              | (states[e-1] >>> 1) | states[e-1]
  states[0] = ((states[0] & mk) >>> 1) | (states[0] & loop)
  for e = 1 .. ambig:
    states[e] |= states[e-1] >>> 1
return (states[ambig] & accept) !== 0
```

JS shifts wrap modulo 32. Insertion/substitution use the previous lower-level states; deletion closure uses the updated ones. Preserve this order in the compatibility replica.

<a id="section-2-4"></a>

### 2.4 Source and published symbol units

The TypeScript source iterates code points. The ES5 published lib iterates UTF-16 units in text but still compiles pattern code points. Consequently identical non-BMP strings need not match at level zero: a😀b against itself is false at 0 and true at 2; 😀 against itself is false at 0. Non-BMP text does not always fail: Include pattern a matches a😀 at 0. See tools/reference/check_lib_quirks.js.

<a id="section-2-5"></a>

### 2.5 Compatibility observations

| ID  | Observed behavior                                                    | Treatment                                                                              |
| --- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Q1  | Published text iteration uses UTF-16 units                           | Default uses source code points; explicit asearch.ts-lib preserves published behavior. |
| Q2  | Length check counts UTF-16 and spaces                                | Compatibility reproduces it; extended indexes use resource limits.                     |
| Q3  | Acceptance is not monotonic: a vs empty gives F,T,F,F at levels 0..3 | Preserve in match(); bulk returns the first accepted level.                            |
| Q4  | Shifts wrap at 32; abc vs abc is false at 31, true at 32             | Preserve wrapping u32 transitions.                                                     |
| Q5  | Negative/fractional ambiguity returns false                          | Preserve documented coercions.                                                         |
| Q6  | Upstream reads process.env and fails without process                 | Deliberately remove this requirement.                                                  |
| Q7  | Unknown modes behave as Exact                                        | Preserve in compatibility only.                                                        |
| Q8  | Locale-sensitive lowercasing depends on host                         | Compile the same JS candidates before WASM.                                            |
| Q9  | Missing match argument throws TypeError                              | Preserve the type, not exact message.                                                  |
| Q10 | Numeric pattern behaves like empty upstream                          | Deliberately reject with TypeError.                                                    |

<a id="section-2-6"></a>

### 2.6 Profiles

| Profile      | Text / pattern symbols   | Initial membership B(i,e) |
| ------------ | ------------------------ | ------------------------- |
| AsearchTs    | Code point / code point  | i == e                    |
| AsearchTsLib | UTF-16 unit / code point | i == e                    |
| Ideal        | Code point / code point  | i <= e                    |

NodeAsearch remains a reference comparator, not a selectable runtime engine. Its UTF-16 pattern/text, ASCII casing, unconditional wildcard spaces and K<=3 are not implicitly adopted.

<a id="section-2-7"></a>

### 2.7 Ideal cost

```text
C[i][0] = i
C[i][j] = min(C[i][j-1] + (i in LOOPS ? 0 : 1),
              C[i-1][j-1] + (EQ_i(t_j) ? 0 : 1),
              C[i-1][j] + 1)
cost(p,t) = C[m][n]
```

Include and wildcard loops skip symbols at zero cost; other insertions, deletions and substitutions cost one. This is the independent minimum-cost reference for bulk ranking.

<a id="section-2-8"></a>

### 2.8 Characterization

For compatibility profiles, integer 0<=e<=31 and profile-consistent symbols:

```text
compat.match(t,e) iff cost(p,t)<=e and e<=m+n
```

Since cost<=m+n, the first accepted level equals Ideal cost. Compatibility's nonmonotonicity only occurs above that minimum. Bulk/transposed/narrowing/DAG engines therefore use monotonic costs; compatibility match retains its u32 acceptance rule.

Proof sketch: after t symbols, level-e positions are those with cost<=e intersected with [e-t,infinity). Initial positions are exactly e. Positions below the cutoff satisfy i+t<e and are regenerated by lower-level paid transitions. At accepting position m the cutoff becomes e<=m+n.

Historical validation found no counterexample in 960,000 characterization triples, no first-level mismatch in 120,000 pairs, and agreement with published JS across 20,071 pairs at levels 0..5. These are finite checks; maintained fixtures and independent oracles remain required.
