# 連携ワークスペースのドキュメント

[English](../README.md)

このワークスペースはRust Release Assetsを利用するTypeScript境界を文書化します。対応するAPIは[現行ランタイム契約](spec/runtime.md)と[パッケージREADME](../../packages/asearch-wasm/README.ja.md)が説明し、過去のマイルストーンの証拠は現在の配信状態や性能保証を意味しません。

| 話題                           | 入口                                             |
| ------------------------------ | ------------------------------------------------ |
| 責務と依存                     | [リポジトリ構成](repository-layout.md)           |
| ビルド・利用・検証             | [ルートREADME](../../README.ja.md)               |
| マイルストーンと受入ゲート     | [計画](PLAN.md)                                  |
| 照合・索引・ランタイムAPI      | [仕様](spec/README.md)                           |
| 採用した判断                   | [判断記録](DECISIONS.md)                         |
| 独立した正しさのモデル         | [参照ツール](../../tools/reference/README.ja.md) |
| 上流原本・ライセンス・ハッシュ | [vendor](../../vendor/README.ja.md)              |

`docs/`にはMarkdownの説明と仕様を置きます。RustソースはRust repoの`crates/`、実行する連携コードは`packages/`と`tools/`、変更しない上流資料は`vendor/`に置きます。上流コードはテスト入力で、製品実装ではありません。英語を正本とし、日本語版は同じ内容の翻訳として、同じ変更で更新します。
