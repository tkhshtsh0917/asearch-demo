# asearch-demo

[asearch](https://github.com/tkhshtsh0917/asearch)のRust/WASM検索を使う、GitHub Pages向けデモ。現在はデータ準備処理を実装しており、検索画面・WASM接続・Pagesデプロイは開発中です。

検索対象は[AutoWikiQA](https://huggingface.co/datasets/cl-nagoya/auto-wiki-qa)の日本語質問文です。回答を生成するアプリではありません。検索結果には質問文と原典のWikipediaリンクを表示する予定です。

## データ準備・検証

[mise](https://mise.jdx.dev/)を利用します。Nodeとpnpmの版は`mise.toml`、依存関係はlockfileで固定しています。

```sh
mise trust
mise install
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm check
mise exec -- pnpm data:prepare
```

`data:prepare`はネットワークアクセスを必要とします。固定したrevisionのParquetから必要な列と先頭10,000行を取得し、`public/data/questions.jsonl`と帰属情報を生成します。出力SHA-256も照合します。データセット全体をブラウザへダウンロードする構成にはしません。生成データはGit追跡対象外です。詳細は[データの扱い](docs/data.md)を参照してください。

同時に`public/data/documents.jsonl`を生成します。こちらは質問文だけを含むasearch CLI用入力です。本体のCLIを用意した後、新しい出力先へ索引を構築できます。

```sh
asearch-cli build public/data/documents.jsonl public/data/questions.asix
asearch-cli search public/data/questions.asix '地理'
```

CLIの導入方法は[asearchのREADME](https://github.com/tkhshtsh0917/asearch#ビルド)を参照してください。既存ファイルへの上書きは拒否されます。バイナリ索引も質問文の派生データとしてCC BY-SA 4.0で扱い、出典のJSONL・帰属情報と一緒に配布します。

本体のRustソース・照合実装・正規化実装はこのrepoへコピーしません。画面は、本体のcommit/versionとSHA-256を固定したWASM配布成果物を利用する予定です。npmへの公開を前提とせず、tarballを受け渡せます。

## 構成

- `tools/data/`: デモ用コーパスの取得・変換・検証。Node上で動くTypeScript。
- `dataset.lock.json`: データのrevision、抽出範囲、原本情報、出力ハッシュ。
- `public/data/`: 生成した質問文と出典情報。ビルド時の入力。
- `docs/`: データの出典と現行の設計。

## ライセンス

デモのコードは[MIT](LICENSE)。AutoWikiQAと抽出したデータには[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)を適用します。ライブラリのライセンスは取り込む配布成果物に同梱します。
