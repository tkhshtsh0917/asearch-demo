# 仕様

[English](../../spec/README.md)

[ランタイム契約](runtime.md)が現在の対応範囲を定義します。既存参照を維持するため数値の節アンカーを残します。過去のマイルストーン報告は日付付きの証拠で、追加APIではありません。

| 節       | 文書                                       |
| -------- | ------------------------------------------ |
| 0, 1, 17 | [スコープと用語](scope.md)                 |
| 2        | [照合意味論](semantics.md)                 |
| 3–7      | [配置とエンジン](engines.md)               |
| 8–10     | [正規化・順位・ポリシー](normalization.md) |
| 11, 20   | [索引形式と更新](index-format.md)          |
| 12–13    | [JS/TS APIとWASMビルド](api.md)            |
| 14–15    | [検証と計測](validation.md)                |
| 16, 18   | [設計理由と参考資料](rationale.md)         |
| 19       | [互換境界](compatibility.md)               |

[アーキテクチャ図](https://github.com/tkhshtsh0917/asearch/blob/main/docs/ja/architecture.md)、[Bitap動画](https://github.com/tkhshtsh0917/asearch/blob/main/docs/ja/algorithm.md)、[ASIXバイト配置](https://github.com/tkhshtsh0917/asearch/blob/main/docs/ja/asix-format.md)はRust repoが管理します。`crates/`はRust repo、`packages/`・`tools/`・`vendor/`はこのワークスペースを指します。[マイルストーン](../PLAN.md)、[判断記録](../DECISIONS.md)、[ビルド手順](../../../README.ja.md)も参照してください。
