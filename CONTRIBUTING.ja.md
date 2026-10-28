# コントリビューション

[English](CONTRIBUTING.md)

## 範囲とセットアップ

このリポジトリはデモ画面、データ準備、TS/JSアダプター、ブラウザテスト、参照モデル、計測ツールを担当します。Rustの文字検索とそのCLI/WASMソースは[asearch](https://github.com/tkhshtsh0917/asearch)、任意のベクトルストアのRustソースは[Vectide](https://github.com/tkhshtsh0917/vectide)が担当します。検証前に[READMEのセットアップ](README.ja.md#セットアップ)を行い、隣接checkoutを暗黙にビルドせず、検証済みのRelease Assetsを使ってください。

## 開発時の検証

セットアップ後、リポジトリのルートで実行します。

```sh
mise exec -- pnpm exec playwright install --with-deps chromium firefox webkit
mise exec -- pnpm check
mise exec -- pnpm --dir integration typecheck
mise exec -- pnpm --dir integration lint
mise exec -- pnpm --dir integration test
mise exec -- pnpm --dir integration test:bench
mise exec -- pnpm --dir integration fixtures:check
mise exec -- pnpm --dir integration docs:check
mise exec -- pnpm --dir integration test:browser
mise exec -- pnpm test:dev
mise exec -- pnpm test:e2e
```

ブラウザテストの前にPlaywrightのブラウザを導入してください。ブラウザの各コマンドは出力先を共有するため直列で実行します。`pnpm analysis:test`は準備済みの実辞書も検証し、通常の単体テストはオフラインのままです。テストとツールの責務は[integrationの構成](integration/docs/ja/repository-layout.md)を参照してください。

## 変更時の規則

アプリケーションコードにはTypeScriptを使います。ファイル・関数を責務ごとに分け、意味のある処理のまとまりの間に空行を入れ、コメントには動作と不可欠な制約を書きます。変更の目的を絞り、ライセンス表示を維持してください。生成データ・配布物・秘密値・作業端末固有のパスをコミットに含めません。

Workerの要求・epoch管理、原文表示、混在IME入力、位置順位、記事フィルタ、原子的な更新・復元の動作を保ちます。修正には回帰検証を追加し、必要に応じて応答遅延や失敗からの回復も含めます。ブラウザプロファイルと合成IMEイベントはエミュレーターレベルの検証で、実機の検証ではありません。

Release・データセット・言語リソースのpinを明示してください。意図的にアダプターを再生成する変更では、元のAssetsを検証し、frozen installの前にルートlockfileを更新します。[ビルド成果物](docs/ja/deployment.md)が生成ファイルと来歴を説明し、[データ](docs/ja/data.md)と[解析](docs/ja/search-analysis.md)が入力・再配布の制約を定義します。

## ドキュメントと計測

READMEと仕様には使い方と対応する動作を書き、Contributor・テスト・ツールのガイドには開発手順を書きます。実行例・図を含め、英語原文と正確な日本語訳を同時に更新します。各契約の正本を1か所に定め、パラメーターを複数のガイドへコピーせず、リンクしてください。

アルゴリズムの比較には[独立した参照モデル](integration/tools/reference/README.ja.md)を使います。性能の変更では計測前に成果物を準備し、結果の同等性を確認し、入力・成果物・ソースの識別情報を記録し、別のペア確認計測で悪化も調べます。[APIの計測](integration/docs/ja/performance.md)と[UIの計測](docs/ja/performance.md)を参照してください。共有CIではばらつく速度の閾値を設けず、正しさを検証します。

## 問題の報告

Rust Releaseのタグ、デモのrevision、ブラウザ・ランタイム、最小入力、再現手順を含めてください。脆弱性の疑いには[セキュリティ方針](SECURITY.md)を使い、認証情報や機微な再現情報を公開しないでください。
