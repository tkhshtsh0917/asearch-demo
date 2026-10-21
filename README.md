# asearch-demo

Rust製AsearchのRelease Assetsを利用する日本語検索デモです。TS/JS API、グルー生成、ブラウザ回帰テストは`integration/`で管理し、画面・データ配信はこのrepoルートで管理します。検索・正規化アルゴリズムは[Rust repo](https://github.com/tkhshtsh0917/asearch)にあります。

## セットアップ

Node/pnpmはmise、wasm-bindgen-cliはRustのCargo.lockと同じ0.2.129を使います。デモ側で検索エンジンのRustソースをビルドしません。公開済みタグとOS別bundleのSHA-256を`release.lock.json`へ設定してください。未設定のOSでは取得を停止します。現在のnullは初回リリース待ちを示し、検証を無効化して進める値ではありません。

```sh
mise install
cargo install wasm-bindgen-cli --version 0.2.129 --locked
mise exec -- pnpm --dir integration install --frozen-lockfile
mise exec -- node tools/engine/build.ts
mise exec -- pnpm install --frozen-lockfile
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

Playwrightコマンドは出力先の衝突を避けて直列実行してください。GitHub Actionsは固定Assetsからビルドし、ライブラリ回帰テスト・画面E2E通過後だけPagesへ反映します。Settings → PagesのSourceをGitHub Actionsに設定してください。実機は保証範囲外です。初回のRustタグ公開とrelease.lock.jsonの実際のAssetハッシュ設定が、公開CI実行前のゲートです。

## 責務

- `src/`: Worker、IME、検索画面、描画。
- `integration/packages/asearch-wasm`: TS APIと生成配布物。
- `integration/tests`: ブラウザ上のライブラリ検証。
- `integration/tools`: グルー生成、fixture/oracle、計測。
- `tools/engine`: Release Assetsの取得・検証。
- `tools/data`, `tools/site`: コーパス取得、索引・差分・出典情報の生成。

AutoWikiQA先頭1万質問の固定シナリオを使用し、質問文だけを索引化します。[データと出典](docs/data.md)、[ライブラリ仕様](integration/docs/spec/README.md)を参照してください。

## ライセンス

デモはMIT。ラッパはMIT OR Apache-2.0、上流由来の原本・NOTICEは各ライセンスを保持します。AutoWikiQA由来データはCC BY-SA 4.0です。

## 謝辞

照合の着想と互換性の基準には[asearch.ts](https://github.com/teramotodaiki/asearch.ts)を参照しています。上流原本とライセンスはintegration/vendorに保持します。
