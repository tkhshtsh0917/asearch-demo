# Compatibility boundary

[日本語](../ja/spec/compatibility.md)

<a id="section-19"></a>

## 19. Compatibility implementation contract

This specifies the maintained boundary, not the obsolete M0 repository layout. [Matching semantics](semantics.md) defines the transition system; [runtime](runtime.md) defines current ownership.

<a id="section-19-1"></a>

### 19.1 Scope

Retain the upstream public class/enum surface with explicit profile selection, minimum-level queries and disposal. Compatibility is distinct from resource-bounded bulk matching. The library does not require a browser process polyfill, implement upstream verbose logging or accept arbitrary non-string texts.

<a id="section-19-2"></a>

### 19.2 Versions

Tool versions come from package.json, lockfiles, mise.toml and the Rust repository's rust-toolchain.toml. wasm-bindgen-cli must match the Rust Cargo.lock version. Historical measurements retain their recorded versions; do not relabel them as current measurements. Build tooling enables only the WASM features actually needed, rather than all-features.

<a id="section-19-3"></a>

### 19.3 Rust core

`asearch-engine` uses wrapping u32 shifts to preserve JS modulo-32 behavior. AsearchTs decodes valid surrogate pairs as code points and preserves lone units; AsearchTsLib iterates UTF-16 units. Native Rust casing uses single-character lower/upper expansions and may differ from host JS locale casing. JS therefore supplies compiled masks for compatibility.

Ambiguity <=31 uses fixed stack states without allocation after preparation. The compatibility-only path up to 65,535 may allocate a temporary state buffer. Ideal uses monotonic initialization without wrapped high-level prefixes. matchLevel remains bounded to 0..31. Core Rust forbids unsafe; test counting allocators and generated WASM boundaries are separate.

<a id="section-19-4"></a>

### 19.4 WASM transport

The thin handle validates configuration/array shape and forwards UTF-16. Passing a JS typed array can allocate/copy into linear memory; native no-allocation claims do not include that transport. Explicit free and finalizer fallback own handles. No caller-generated pointer or unchecked file cast is accepted.

<a id="section-19-5"></a>

### 19.5 Observable JS behavior

Compilation reads mutable Asearch.MAXLENGTH on each construction, keeps the original mode and pattern values, splits with Array.from, and computes masks using host casing. Only single-code-point mask keys cross into Rust. Own field order and numeric enum reverse mapping match the reference. Mutating instance masks/fields after construction does not change the compiled native matcher; this is a documented deviation. MAXLENGTH defaults to 31 and is writable.

Pattern/text must be primitive strings or actual String objects checked through String.prototype.valueOf, including other realms; forged toStringTag is insufficient. Pattern String objects remain observable as objects. Text is converted to a primitive string before UTF-16 transport. Numeric/array texts deliberately fail TypeError.

Compatibility ambiguity conversion preserves operation order: evaluate ambig+1 and ToLength first; reject array lengths above 2^32-1; check text type; then compute ToPropertyKey(ambig). Only canonical nonnegative integer property names within the computed length are accepted. Negative, fractional, NaN, null, true, "01" and " 1" cases return false. "1" and [1] behave as level 1. BigInt/Symbol conversion errors propagate. Symbol property keys return false; the incidental array-length property behavior is not reproduced. Integer ambiguity above 65,535 is rejected with RangeError. Disposal is rechecked after caller coercions.

Type compatibility is one-way against upstream's public Pick surface and constructor/enum shapes. Upstream private members prevent nominal assignment to the full upstream class; upstream objects do not satisfy the added disposal API.

<a id="section-19-5-1"></a>

### 19.5.1 Initialization attempts

Builds derive expected export names/kinds from optimized WASM and guard generated glue before caching it. Mismatches fail initialization; this checks export shape, not signatures or asset authenticity. Changes to the glue insertion point fail the build for review.

Browser state is uninitialized → initializing → ready or failed. Module evaluation attempts default initialization and waits for completion, but catches failure so imports remain usable. The exported ready promise itself stays rejected on failure; an immediate internal catch prevents unhandled rejection. A retry replaces the live ready binding; a previously captured promise never changes.

| Call                                    | Behavior                                                        |
| --------------------------------------- | --------------------------------------------------------------- |
| init(input?) while uninitialized/failed | Start a new attempt and replace ready.                          |
| init() while initializing               | Return the same attempt promise.                                |
| init(input) while initializing          | Reject INITIALIZATION_IN_PROGRESS without changing the attempt. |
| init() after ready                      | Return current resolved ready.                                  |
| init(input) after ready                 | Reject ALREADY_INITIALIZED; do not invalidate handles.          |

Explicit undefined is equivalent to no input. Inputs are WebAssembly.Module, BufferSource or URL. Initialization failures report INITIALIZATION_FAILED and preserve cause. Constructors require installed ready bindings. Await init(input) when retrying. Dynamic import resolves after the initial attempt; calling init during that same module's initial evaluation is not promised.

Node ESM/CJS initialize local artifacts synchronously. On success ready resolves and init(input?) is a no-op returning it. Missing/corrupt local artifacts fail import/require; browser network-retry semantics do not apply to Node.

<a id="section-19-6"></a>

### 19.6 Fixtures

`tools/fixtures/gen.mjs` runs hashed vendored upstream originals with fixed seeds/locale to regenerate fixtures/compat.json. Source and published-lib expectations are separate. Include empty/space patterns, length boundaries, lone surrogates, non-BMP, casing and wrapping ambiguity levels. Do not format upstream originals.

<a id="section-19-7"></a>

### 19.7 Node tests

Test ESM/CJS, runtime coercion order, profile differences, disposal/reentry, public types and packed artifacts outside the workspace. Independent minimum-cost oracles supplement compatibility fixtures; passing one does not replace the other.

<a id="section-19-8"></a>

### 19.8 Browser tests

Playwright Chromium/Firefox/WebKit verify loading, failures/retry, Workers, strict boundaries and updates. The demo adds synthetic IME and mobile-profile UI tests. These do not prove OS IME or physical-device behavior.

<a id="section-19-9"></a>

### 19.9 CI

Rust checks run in the Rust repository; generated adapter, Node/browser regressions and demo E2E run here against verified Release Assets. Report actual hosted runs separately from local checks.

<a id="section-19-10"></a>

### 19.10 Notices

Keep upstream source licenses/hashes, Rust/WASM notices and dependency notices in every relevant distribution. Root new code uses its declared license; data attribution has separate requirements.

<a id="section-19-11"></a>

### 19.11 Distribution

Browser ESM uses web glue; Node ESM/CJS uses nodejs glue with a nested commonjs package marker. Generated files are Git-ignored. Conditional exports carry ESM/CJS declarations. A locally packed adapter is not an npm publication.
