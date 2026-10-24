# WASM連携ワークスペース

[English](README.md)

このワークスペースはTS/JS API、wasm-bindgenグルー生成、ブラウザ回帰テスト、互換oracle、計測ツールを管理します。Rustのソースは[asearch](https://github.com/tkhshtsh0917/asearch)にあります。

ルートの`release.lock.json`に公開済みタグとOS別Release AssetのSHA-256を記録し、デモrepoルートで`pnpm engine:build`を実行してください。このワークスペースはRustソースの取得やCargoビルドを行いません。

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm test:browser
pnpm test:bench
pnpm fixtures:check
```

APIの契約は[仕様](docs/ja/spec/README.md)、利用法は[パッケージREADME](packages/asearch-wasm/README.ja.md)を参照してください。検証済みWASMとCLIは`.engine/release`に配置します。独立した計測値の詳細を公開READMEの性能保証へ転用しないでください。
