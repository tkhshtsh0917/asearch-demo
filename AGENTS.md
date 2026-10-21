# asearch-demo contributor instructions

- デモのUI・データ準備・Pages設定はこのrepo。本体のRustコア/CLI/WASMは[asearch](https://github.com/tkhshtsh0917/asearch)に置く。検索や正規化の別実装をここへ作らない。
- WASMはrelease.lock.jsonでタグとSHA-256を固定したRelease Assetsを使う。隣接checkoutへの依存や最新branchの暗黙取得を作らない。TS API・グルー生成・回帰検証はintegration/に置き、タグのRelease Assetsを利用する。
- データは`dataset.lock.json`と[docs/data.md](docs/data.md)に従う。質問文だけを検索対象とし、出典とCC BY-SA 4.0の表示を維持する。帰属情報は生成物にもUIにも付ける。
- 未実装の画面やPagesデプロイを完成扱いしない。現状と再現コマンドはREADMEへ書く。
- TypeScript必須。意味のあるファイル/関数の粒度と空行を保ち、`mise exec -- pnpm check`を通す。外部データ取得は通常の単体テストから分離する。
- 公開ファイルへ個人の絶対パス、トークン、非公開環境への参照を入れない。秘密の設定はcommitしない。
- commit/pushは利用者の許可がある場合だけ。生成データ・ログ・node_modules・配布tarballを追跡しない。
