# ドキュメント

[原文](../README.md) · 日本語版

目的に応じた文書の入口と、実装・仕様・設計記録の読み分け方を案内します。

| 読みたいこと                         | 入口                                          |
| ------------------------------------ | --------------------------------------------- |
| 製品・WASM境界・テスト・利用例の配置 | [リポジトリ構成](repository-layout.md)        |
| ビルド・利用・検証                   | [ルートREADME](../../README.ja.md)            |
| 現行APIと拡張仕様                    | [仕様索引](spec/README.md)                    |
| 採用理由・確定事項                   | [判断記録](DECISIONS.md)                      |
| 独立した正しさのモデル               | [参照ツール](../../tools/reference/README.md) |
| 上流の原本・ライセンス・ハッシュ     | [vendor](../../vendor/README.md)              |

`docs/`はMarkdownの説明と仕様を置く場所です。RustコードはRust repoの`crates/`、このworkspaceの実行コードは`packages/`・`tools/`、改変しない上流資料は`vendor/`に配置します。上流のコードはテストの入力であり、製品の実装ではありません。完了済み作業の引き継ぎ手順や、設計時の代理計測ログは現行ドキュメントとして維持しません。

## 日本語版の読み方

現在の使い方はREADMEとランタイム契約を参照してください。識別子・コマンド・データ形式は日英で共通です。

| 文書                                           | 書かれていること                                                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [DECISIONS.md](DECISIONS.md)                   | 互換性、正規化、API、更新方式、性能改善を採用した理由と判断の経緯を記録します。                              |
| [README.md](README.md)                         | 目的に応じた文書の入口と、実装・仕様・設計記録の読み分け方を案内します。                                     |
| [repository-layout.md](repository-layout.md)   | Rust本体、TS API、ブラウザ検証、デモ画面、生成物の配置と依存方向を説明します。                               |
| [spec/README.md](spec/README.md)               | 詳細仕様をテーマ別に案内し、現行契約と過去の設計案の優先順位を説明します。                                   |
| [spec/api.md](spec/api.md)                     | JS/TS APIとWASM境界の設計を説明します。過去のAPI案を含むため、現行の公開範囲はruntime.mdを優先してください。 |
| [spec/compatibility.md](spec/compatibility.md) | 移植初期の互換API、上流との比較方法、当時の構成と検証条件を説明する設計記録です。                            |
| [spec/engines.md](spec/engines.md)             | 照合エンジンのデータ配置、ビット並列処理、逐次検索の仕組みと将来案を説明します。                             |
| [spec/index-format.md](spec/index-format.md)   | ASIXのバイナリ形式、容量上限、base/deltaと削除情報、manifestによる更新の契約を説明します。                   |
| [spec/normalization.md](spec/normalization.md) | 日本語の表記揺れの正規化、検索結果の順位、入力長に応じた曖昧度の決め方を説明します。                         |
| [spec/rationale.md](spec/rationale.md)         | 設計上のトレードオフと、アルゴリズム・互換性の参考資料をまとめます。                                         |
| [spec/runtime.md](spec/runtime.md)             | 現在のcrateとAPIの責務、読み取り専用WASM、CLI生成、fixtureと配信の契約を定めます。最初に読む仕様です。       |
| [spec/scope.md](spec/scope.md)                 | ライブラリが扱う問題、対象外の機能、仕様全体で使う用語を説明します。                                         |
| [spec/semantics.md](spec/semantics.md)         | 一致・ワイルドカード・編集コスト・profileの違いなど、検索結果の正しさを決める規則を説明します。              |
| [spec/validation.md](spec/validation.md)       | 互換fixture、独立oracle、破損入力、資源上限、ベンチマークの受入条件を説明します。                            |

原文と日本語版は同じ変更で更新します。仕様の優先順位は現行契約を優先し、過去の設計記録を実装済みAPIと混同しないでください。
