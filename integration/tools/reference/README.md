# Executable reference models

[日本語](README.ja.md)

These Python/Node models are independent of the product and verify semantics/algorithms, not speed. Rust product tests live in the Rust repository's crates/asearch-engine/tests; JS tests live in this workspace's packages/asearch-wasm/test.

| File                             | Responsibility                                                        |
| -------------------------------- | --------------------------------------------------------------------- |
| ref.py                           | Upstream bit transitions, naive Ideal DP and transposed DP.           |
| oracle.js                        | Execute vendored published upstream JS.                               |
| verify.py                        | Differentially check replica/transposed/naive/upstream results.       |
| characterize.py / first_level.py | Characterize nonmonotonic levels and first accepted levels.           |
| verify_ext.py                    | Compare DAG, OSA and incremental-row models with independent oracles. |
| check_lib_quirks.js              | Check known upstream boundary behavior.                               |
| src_oracle.cjs                   | Run upstream source semantics using TypeScript 5.9.3.                 |

## Usage

Python 3.10+ and Node are required. Run from the integration root. -I -B reduces Python environment dependence and cache output.

```sh
mise exec -- node tools/reference/check_lib_quirks.js vendor/upstream/asearch.ts/lib/index.js
mise exec -- python3 -I -B tools/reference/verify.py vendor/upstream 31 3000
python3 -I -B tools/reference/characterize.py 7
python3 -I -B tools/reference/first_level.py
python3 -I -B tools/reference/verify_ext.py
mise exec -- node tools/reference/src_oracle.cjs vendor/upstream
```

The source oracle uses TypeScript 5.9.3 isolated in tools/fixtures. See [vendor](../../vendor/README.md) for originals/sources/hashes and the [specifications](../../docs/spec/README.md) for contracts.

## Limits

Passing DAG/transposed model tests does not implement those features in the product. Each milestone also needs product tests for format, resource limits, updates and sessions. Obsolete client-overlay experiments are excluded from current models.

Do not generalize Python/JS casing agreement to all Unicode. JS-generated masks and product fixtures separately verify locale behavior.
