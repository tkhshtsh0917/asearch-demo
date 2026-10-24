# asearch-demo

[日本語版](README.ja.md)

Rust製AsearchのRelease Assetsを利用する日本語検索デモです。TS/JS API、グルー生成、ブラウザ回帰テストは`integration/`で管理し、画面・データ配信はこのrepoルートで管理します。検索・正規化アルゴリズムは[Rust repo](https://github.com/tkhshtsh0917/asearch)にあります。

IMEの変換中も現在の入力値で検索し、確定・候補の置換・キャンセル後は最新の値へ追従します。入力欄の内容や選択範囲は書き換えません。ブラウザ互換性は合成IMEイベントを含むPlaywright検証の範囲です。

読み・ローマ字・同義語はサーバー専用のRust解析CLIで事前生成し、原文とは別の検索用textsに登録します。ASIX v1とブラウザ側の正規化・検索処理は維持します。[検索用解析の詳細](docs/search-analysis.md)を参照してください。この機能には解析コマンドを含むRust CLI（v0.2.0以降）が必要です。公開前の明示的なローカル検証では`ASEARCH_ANALYZER_CLI`へビルド済みCLIを指定できます。v0.2.0公開後にそのReleaseのpinへ切り替えてください。

## セットアップ

Node/pnpmはmise、システム辞書の展開に`unzip`、wasm-bindgen-cliはRustのCargo.lockと同じ0.2.129を使います。デモ側で検索エンジンのRustソースをビルドしません。ローカルでは`tools/engine/select.ts`で公開済みタグとOS別bundleのSHA-256を`release.lock.json`へ設定してください。未設定のOSでは取得を停止します。公開済みv0.1.0のSHAを記録しています。未公開AssetsのSHAを捏造せず、別版へ切り替える場合は公開後にpinを更新します。

```sh
mise install
cargo install wasm-bindgen-cli --version 0.2.129 --locked
mise exec -- pnpm --dir integration install --frozen-lockfile
mise exec -- node tools/engine/select.ts v0.2.0
mise exec -- node tools/engine/build.ts
mise exec -- pnpm install --lockfile-only --update-checksums --ignore-scripts
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm analysis:prepare
mise exec -- pnpm check
mise exec -- pnpm data:prepare
BASE_PATH=/asearch-demo/ mise exec -- pnpm build
mise exec -- pnpm preview --base /asearch-demo/
```

`engine:build`はbundleのSHA-256を検査し、WASMからJSグルーとTS APIを生成・packします。意図的に版やラッパを更新した場合は、検証後にルートのpnpm-lock.yamlも更新します。通常のCIはfrozen lockfileで実行します。ローカルで同じAssetsを用意した場合は`node tools/engine/build.ts PATH_TO_ASSET_DIRECTORY`を使えます。隣接Rust checkoutは暗黙に参照しません。

## 検証と配信

```sh
mise exec -- pnpm --dir integration typecheck
mise exec -- pnpm --dir integration lint
mise exec -- pnpm --dir integration test
mise exec -- pnpm --dir integration test:browser
mise exec -- pnpm test:dev
mise exec -- pnpm test:e2e
```

## 責務

- `src/`: Worker、IME、検索画面、描画。
- `integration/packages/asearch-wasm`: TS APIと生成配布物。
- `integration/tests`: ブラウザ上のライブラリ検証。
- `integration/tools`: グルー生成、fixture/oracle、計測。
- `tools/engine`: Release Assetsの取得・検証。
- `tools/analysis`: 上流言語リソースの取得・版固定・Rust解析CLIの呼出し。
- `tools/data`, `tools/site`: コーパス取得、CLIによる索引・差分・出典情報の生成。

AutoWikiQA先頭1万質問の固定シナリオを使用し、質問文だけを索引化します。[データと出典](docs/data.md)、[ライブラリ仕様](integration/docs/spec/README.md)を参照してください。

## ライセンス

デモはMIT。ラッパはMIT OR Apache-2.0、上流由来の原本・NOTICEは各ライセンスを保持します。AutoWikiQA由来データはCC BY-SA 4.0です。

## 謝辞

照合の着想と互換性の基準には[asearch.ts](https://github.com/teramotodaiki/asearch.ts)を参照しています。上流原本とライセンスはintegration/vendorに保持します。

ブラウザ向けWASMは読み取り専用です。索引生成・圧縮は取得済みCLIが担当します。初回ReleaseやAsset更新時には、SHA固定後に`engine:build`で生成したtarballを検証し、`pnpm install --update-checksums`でルートlockfileを更新してからfrozen installと回帰検証を行います。

索引生成をCLIへ分離したWASMは、同一ツールでの比較でraw 298,174 → 285,543 byte（約4.2%減）となりました。gzip/Brotliでも縮小を確認しています。このサイズ比較は検索速度の保証ではありません。

Worker往復とDOM反映の計測方法は[デモ性能ガイド](docs/performance.md)を参照してください。
