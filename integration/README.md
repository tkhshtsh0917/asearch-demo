# WASM integration workspace

[日本語版](README.ja.md)

このworkspaceはTS/JS API、wasm-bindgenグルー生成、ブラウザ回帰テスト、互換oracle、計測ツールを管理します。Rustのビルド元は[asearch](https://github.com/tkhshtsh0917/asearch)です。

ルートの`release.lock.json`に公開済みタグとOS別Release AssetのSHA-256を記録してから、デモrepoルートで`pnpm engine:build`を実行してください。Rustソースの取得やCargoビルドは行いません。

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

APIの契約は[仕様](docs/spec/README.md)、利用法は[パッケージREADME](packages/asearch-wasm/README.md)を参照してください。WASMとCLIは`.engine/release`に検証済みのものを配置します。独立した計測値の詳細は公開READMEの性能保証へ転用しません。
