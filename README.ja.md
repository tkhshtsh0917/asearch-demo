# asearch-demo

[English](README.md)

Rust製AsearchのRelease Assetsを利用する日本語検索デモです。TS/JS API、グルー生成、ブラウザ回帰テストは`integration/`で管理し、画面・データ配信はこのrepoルートで管理します。検索・正規化アルゴリズムは[Rust repo](https://github.com/tkhshtsh0917/asearch)にあります。

IMEの変換中も現在の入力値で検索し、確定・候補の置換・キャンセル後は最新の値へ追従します。入力欄の内容や選択範囲は書き換えません。ブラウザ互換性は合成IMEイベントを含むPlaywright検証の範囲です。

検索に失敗しても、Workerを再起動せずに後続の正常な検索で回復できます。検索エラーは新しい結果を採用したときだけ解消し、古い応答で現在のエラーを消すことはありません。公開データの更新エラーは独立して表示を維持します。

サーバー専用のRust解析器が読み・ローマ字・同義語・クエリ変換表を生成します。質問原文を維持し、補助`texts`にはASIX v1を使います。語単位の動詞正規化により`食べた`と`食べる`は同じクエリで検索し、上限内の変換で入力が変わる場合は、`びーt`→`bi-t`や`にh`→`nih`のように両方の表記で検索し、候補を重複排除して統合します。コーパスの順位は編集距離、一致開始位置、order、keyの順です。範囲と上限は[検索用解析](docs/ja/search-analysis.md)を参照してください。

コミット済みの構成は、公開済みのRust CLI・WASM **v0.4.0**のRelease Assetsを使います。ネイティブのクエリ変換表出力と位置順位には互換性のある0.3以降の成果物が必要で、版を更新する際はハッシュ検証と回帰テストを行います。

検索結果画面の左側に、記事と更新状態のチェックボックスを表示し、複数選択とキーワードに連動した件数で絞り込めます。スマホでは折りたたみパネルを使います。選択した条件は個別に解除できるチップで表示し、復元後に0件となった選択も保持します。OR／ANDの規則と上限は[ファセット](docs/ja/data.md#記事ファセット)を参照してください。元の`text`段落から作った短いプレーンテキストの抜粋で内容を把握でき、生成回答や追加の検索対象としては扱いません。

## セットアップ

Node/pnpmはmise、システム辞書の展開に`unzip`、wasm-bindgen-cliは選択したRust Releaseに対応する0.2.129を使います。デモ側で検索エンジンのRustソースをビルドしません。`release.lock.json`は公開済みv0.4.0と3 OSすべてのbundleのSHAを固定しています。以下のコマンドは`tools/engine/select.ts`で同じReleaseを選び、未設定のOSのSHAがあれば準備を停止します。

```sh
mise install
cargo install wasm-bindgen-cli --version 0.2.129 --locked
mise exec -- pnpm --dir integration install --frozen-lockfile
mise exec -- node tools/engine/select.ts v0.4.0
mise exec -- node tools/engine/build.ts
mise exec -- pnpm install --lockfile-only --update-checksums --ignore-scripts
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm analysis:prepare
mise exec -- pnpm check
mise exec -- pnpm data:prepare
BASE_PATH=/asearch-demo/ mise exec -- pnpm build
mise exec -- pnpm preview --base /asearch-demo/
```

`engine:build`はbundleのSHA-256を検査し、WASMからJSグルーとTS APIを生成・packします。意図的に版やラッパを更新した場合は、検証後にルートのpnpm-lock.yamlも更新します。CIは利用するReleaseを固定した後にfrozen installを実行します。ローカルで同じAssetsを用意した場合は`node tools/engine/build.ts PATH_TO_ASSET_DIRECTORY`を使えます。隣接Rust checkoutは暗黙に参照しません。

## 開発

検証コマンド、コードとテストの変更規則、日英ドキュメントの更新は[コントリビューションガイド](CONTRIBUTING.ja.md)を参照してください。静的サイトの成果物と版の確認は[ビルドガイド](docs/ja/deployment.md)、Worker往復・DOMの計測は[性能ガイド](docs/ja/performance.md)にあります。

## 責務

- `src/`: Worker、IME、検索画面、描画。
- `integration/packages/asearch-wasm`: TS APIと生成配布物。
- `integration/tests`: ブラウザ上のライブラリ検証。
- `integration/tools`: グルー生成、fixture/oracle、計測。
- `tools/engine`: Release Assetsの取得・検証。
- `tools/analysis`: 上流言語リソースの取得・版固定・Rust解析CLIの呼出し。
- `tools/data`, `tools/site`: コーパス取得、CLIによる索引・差分・出典情報の生成。

AutoWikiQA先頭1万質問の固定シナリオを使用し、質問文だけを索引化します。画面では差分適用、同じ内容の圧縮版の読み込み、初期状態への復元、Workerの再起動ができます。[データと出典](docs/ja/data.md)、[ライブラリ仕様](integration/docs/ja/spec/README.md)、[文書一覧](docs/ja/README.md)を参照してください。

## ライセンス

デモはMIT。ラッパはMIT OR Apache-2.0、上流由来の原本・NOTICEは各ライセンスを保持します。AutoWikiQA由来データはCC BY-SA 4.0です。

## 謝辞

照合の着想と互換性の基準には[asearch.ts](https://github.com/teramotodaiki/asearch.ts)を参照しています。上流原本とライセンスはintegration/vendorに保持します。
