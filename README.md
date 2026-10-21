# asearch-demo

[asearch](https://github.com/tkhshtsh0917/asearch)のRust/WASM検索を、専用Workerで実行する静的デモです。TypeScript・Viteを使い、GitHub Pagesのサブパスから配信できます。質問入力をサーバーへ送信しません。

- AutoWikiQAの先頭1万件の質問文を逐次検索し、一致範囲とWikipediaの出典を表示します。
- 意図表現では、選択肢を全展開せずDAGで検索する3件の例を試せます。
- 「差分を適用」で3件の変更・1件の削除・1件の追加、「圧縮版へ切替」で同じ内容の単一索引を読み込みます。固定の更新シナリオであり、ライブのWikipedia更新を監視する機能ではありません。
- 更新中は旧索引で検索でき、取得・整合性検証に失敗した場合も旧状態を維持します。再読み込みで初期世代へ戻ります。

## 準備・ビルド

[mise](https://mise.jdx.dev/)でNodeとpnpmを用意します。ツール版・依存は固定されています。WASMパッケージはnpmへ公開せず、`engine.lock.json`でソースのコミットとtarballのSHA-256を固定しています。生成物はGitへ含めません。

```sh
mise trust
mise install
```

最初にWASM配布物を用意します。Rust 1.97.0・`wasm32-unknown-unknown` target・wasm-bindgen-cli 0.2.129を利用できる環境では、次のコマンドで固定コミットから独立した一時ディレクトリにビルドできます。Node標準APIだけで動くため、依存のインストール前に実行できます。ネットワーク接続が必要です。

```sh
mise exec -- node tools/engine/build.ts
```

または、本体repoの[ビルド手順](https://github.com/tkhshtsh0917/asearch#ビルド)で生成した、ハッシュが一致するtarballを明示して取り込めます。隣接checkoutには依存しません。

```sh
mise exec -- node tools/engine/prepare.ts PATH_TO_ARCHIVE
```

その後、次を実行します。

```sh
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm check
mise exec -- pnpm data:prepare
mise exec -- pnpm build
mise exec -- pnpm preview
```

表示URLはコマンド出力を参照してください。`data:prepare`は固定データをネットワークから取得し、質問文のSHA-256を照合します。`build`は索引・差分・出典カタログ・manifestを生成し、配布物を`dist/`へ出力します。開発中は初回の`build`後に`pnpm dev`を使えます。HTTPSまたはlocalhostが必要です。

GitHub Pagesの配置先で検証する場合は、ビルドとpreviewの両方に同じbaseを指定します。

```sh
BASE_PATH=/asearch-demo/ mise exec -- pnpm build
mise exec -- pnpm exec playwright install chromium firefox webkit
mise exec -- pnpm test:dev
mise exec -- pnpm test:e2e
# 手動で表示する場合
mise exec -- pnpm preview --base /asearch-demo/
```

E2EはChromium・Firefox・WebKitとAndroid/iPhoneのモバイルプロファイルで、本番ビルドの検索・説明・IME・更新中検索・破損差分の拒否・再試行・レイアウト・重大なアクセシビリティ違反を検証します。端末実機やクラウドのブラウザ検証には依存しません。画面の時間はWorker内の検索と説明の所要時間で、ネットワーク・描画を含む性能保証ではありません。

## GitHub Pages

先に`engine.lock.json`の固定コミットが本体の公開リポジトリから取得できるようにしてください。その後、このrepoのSettings → Pages → Build and deploymentでSourceを **GitHub Actions** に設定し、mainへpushします。ワークフローが固定エンジンのビルド・配布物のハッシュ照合・データ取得・検証を行い、成功した成果物だけを配信します。

ローカルでの検証とGitHub上のCI/Pages成功は別です。新しい環境でtarballが再現しない場合は、検証を無効化せず、差分を調べてエンジンの版とpinを一緒に更新してください。`engine:build`は公開済みの固定コミットを必要とします。

## 構成と境界

- `src/`: 検索画面、Worker、受信データ検証。検索・正規化アルゴリズムは実装しません。
- `tools/engine/`: 版固定したWASM配布物の検証・準備。
- `tools/data/`: コーパスの取得・抽出・検証。
- `tools/site/`: ASIX・差分・圧縮版・manifest・出典カタログの生成。
- `public/data/`: 取得済みのビルド入力。`public/site/`: 生成した配信用データとライセンス。いずれも追跡対象外。
- `tests/`: Playwrightによる本番ビルドの検証。

データのrevision・抽出範囲・ハッシュは`dataset.lock.json`、出典と制約は[データの扱い](docs/data.md)を参照してください。

## ライセンス

デモのコードは[MIT](LICENSE)。AutoWikiQAと抽出・改変データには[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)を適用します。回答を生成するアプリではありません。先頭1万件は無作為抽出でも全体の代表標本でもありません。配布物には出典カタログ・変更内容とライブラリのライセンスを同梱します。
