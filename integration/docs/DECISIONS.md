# Design decisions

[日本語](ja/DECISIONS.md)

These choices explain the current architecture. The [runtime contract](spec/runtime.md) defines supported APIs and the [specifications](spec/README.md) define matching and format details.

## Compatibility and normalization

Compatibility APIs distinguish code-point and UTF-16 behavior. Ideal matching provides monotonic edit costs separately from compatibility profiles. Bulk search uses bounded Japanese normalization and a normalized-length ambiguity policy; it does not delegate its Unicode behavior to a host's full NFKC implementation.

## Server construction and browser search

The server builds immutable ASIX base/delta/tombstone segments and compacts them canonically. The browser validates, searches and atomically adopts them; no browser editing overlay is provided. Analysis, readings and synonyms stay in the server-only analyzer. The host owns transport, update scheduling, query lookup policy and learned relevance.

## Ownership and budgets

Immutable corpus structures are separate from query workspaces and sessions. Capacity accounting includes transport/staging and failed adoption preserves the active state. Results count distinct live keys independently of top-N; optional positional ordering uses one comparator across aliases and segments. Explanations use explicit coordinate spaces and bounded deterministic alignment.

## Execution paths

Sessions can reuse prefix checkpoints and complete candidates, including candidates outside earlier top-N results. Scalar and transposed paths must preserve the same requested semantics. The distribution uses baseline WASM; additional kernels require equivalent behavior, safe fallback and controlled public-API evidence. Intent expressions use a bounded DAG rather than enumerating every expansion.

## Validation and licensing

Independent models, pinned upstream fixtures and resource/error regressions complement product tests. See [validation](spec/validation.md) and [Contributing](../../CONTRIBUTING.md). New core/adapter code is MIT OR Apache-2.0; upstream originals retain their own notices.
