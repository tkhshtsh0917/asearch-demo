# Adopted decisions

[日本語](ja/DECISIONS.md)

This is a concise record of settled choices. Current APIs are specified by [runtime](spec/runtime.md); dates and detailed measurements remain scoped to their original evidence.

<a id="d1-compat-asearch-の既定プロファイル"></a>

## D1: Compatibility profile

Asearch defaults to code-point asearch.ts semantics; asearch.ts-lib explicitly selects published UTF-16 behavior.

<a id="d2-一括-api-の既定の曖昧度ポリシー"></a>

## D2: Ambiguity policy

Bulk defaults to min(floor(normalized length/4),3); descriptor and custom policies remain bounded.

<a id="d3-パッケージクレート名"></a>

## D3: Names and ownership

Rust crates use explicit index/builder/analyzer/engine/CLI/WASM responsibilities; the local TS adapter remains asearch-wasm.

<a id="d4-一括-api-の正規化の既定"></a>

## D4: Bulk normalization

Use ja-basic-v1 options 1–5 by default; compatibility Asearch does not normalize.

<a id="d5-一括-api-の既定モード"></a>

## D5: Bulk matching mode

Default to WildcardSpace with internal wrap; Exact and Include keep their distinct rules.

<a id="d6-ロードマップ"></a>

## D6: Milestones

Keep correctness gates at every milestone; optimize optional engines only after measured equivalence and benefit.

<a id="d7-プロジェクトのライセンス"></a>

## D7: License

New core/adapter code is MIT OR Apache-2.0; upstream originals retain their notices.

<a id="d8-リポジトリのスコープ"></a>

## D8: Scope

Matching and time-to-results are the engine scope; UI, delivery orchestration and learned ranking are host concerns.

<a id="d9-索引の配信形式と更新方式"></a>

## D9: Server updates

Use immutable base/delta/tombstone segments and manifests with native server compaction.

<a id="d10-m0-の互換境界の細目asearchts-からの逸脱を含む"></a>

## D10: Compatibility deviations

Preserve observable matching/coercion behavior; deliberately reject unsafe or nonsensical runtime inputs and remove Node-only global requirements.

<a id="d11-初期化試行とreadyの契約"></a>

## D11: Initialization

One ready promise per attempt; no-input concurrent calls share it, failures can retry, conflicting explicit initialization is rejected.

<a id="d12-資源予算更新失敗overlay部分はd18で廃止"></a>

## D12: Resource and update failure

Reserve aggregate capacities, include transport/staging, and preserve active state on failed adoption.

<a id="d13-bylengthの長さの定義"></a>

## D13: Length counting

Determine K after normalization and before wrap, using explicit profile/code-point/utf16 units.

<a id="d14-manifestの系列と適用完了状態"></a>

## D14: Manifest identity

Keep indexId/config stable per series; advance the applied full manifest only after atomic adoption.

<a id="d15-文書単位の総件数"></a>

## D15: Totals

Count distinct live document keys by minimum matching level, independently of top-N.

<a id="d16-性能回帰の再現可能な判定"></a>

## D16: Performance decisions

Use paired AB/BA, fixed workloads, reproducible aggregation and confirmed regression rules; avoid timing gates on shared CI.

<a id="d17-文書と品質ツールの入口"></a>

## D17: Quality entry points

Keep formatter, linter, types, tests and docs as explicit reproducible commands.

<a id="d18-サーバー配信のみとしクライアント編集層を除外する"></a>

## D18: No editing overlay

Only server-published indexes and deltas are adopted; browser upsert/remove/forget APIs are absent.

<a id="d19-開発環境と公開用の品質設定"></a>

## D19: Tool configuration

Pin language/dependency tools; do not expose private paths, secrets or workstation-specific instructions.

<a id="d20-m1の最小level-apiの境界"></a>

## D20: Minimum level API

matchLevel returns the first accepted level within 0..31 or -1; explicit disposal is idempotent.

<a id="d21-汎用scalarwmとworkspaceの入口"></a>

## D21: Generic scalar workspaces

Reserve reusable scalar buffers explicitly and distinguish compatibility from extended resource-bounded matching.

<a id="d22-単発asearchのidealプロファイル"></a>

## D22: Ideal profile

Use monotonic Ideal costs for minimum-level engines while preserving compatibility acceptance separately.

<a id="d23-コーパス単位のengine境界"></a>

## D23: Corpus engine boundary

Separate immutable corpus preparation from query/workspace state and reusable hot-path evaluation.

<a id="d24-ja-basic-v1の限定対応表と確保しない変換"></a>

## D24: Limited normalization

Use explicit Unicode tables and allocation-free transforms, not host-dependent full NFKC.

<a id="d25-asix-v1の圧縮と原文保持"></a>

## D25: ASIX and originals

Keep canonical uncompressed ASIX plus optional originals; compression is an HTTP/server concern.

<a id="d26-説明の座標と整列"></a>

## D26: Explanations

Return explicit coordinate spaces with bounded deterministic traceback; never fabricate original offsets.

<a id="d27-intentindex-v1の構文と資源境界"></a>

## D27: Intent DAG

Use a bounded parser and search the DAG without enumerating all expansions.

<a id="d28-m7の採否とスカラー経路の改善"></a>

## D28: M7 optimization decision

Retain scalar candidate preparation and shared compilation improvements. Keep baseline WASM; SIMD/Myers/OSA/NodeAsearch are not selected runtime engines.
