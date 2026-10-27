# Vector-storeのブラウザ統合

[English](README.md)

このprivateなTypeScript workspaceは、明示的に指定したnative CLI・raw WASM成果物を利用します。安全なbyte入力、clientに紐付くsnapshot handle、協調型のブラウザ実行制御、独立したnative・WASM適合性検査を担当します。Rustエンジン・builderのsourceはvector-storeに置き、npm packageは公開しません。

## 準備と検査

このディレクトリから、repoで固定するNode.js・pnpm環境を導入して実行します。

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm prepare:assets /path/to/verified-release-bundle
pnpm build
pnpm test:browser chromium
```

パスは明示的な入力であり、隣のcheckoutを推測しません。bundleはrelease.json、SHA256SUMS、native vector-store、raw vector_wasm.wasm、projectのlicenseを含みます。準備でschema、sourceの識別情報、ファイル長、SHA-256を検証し、対応するwasm-bindgen 0.2.129でweb bindingsを生成します。渡されたCLIでbase・delta・圧縮済みfixtureと完全探索の参照結果を作り、Rustはコンパイルしません。sourceに差分のある開発用bundleには明示的な--allow-dirty引数が必要で、製品成果物はcleanなsourceを識別する必要があります。

他のブラウザprofileはfirefox、webkit、android-profile、iphone-profileです。preview portを共有するため順に実行します。nativeとの正確な順位一致、top-k前のfilter、更新・復元、handleの所有、不正入力、typed-arrayサブクラス・独自getter、detach済みbuffer、キャンセル、回復を検査します。モバイルprofileはhost上のエミュレーションであり、実機やブラウザ推論のメモリを保証しません。

成果物コマンドが置き換えるのは、自身が生成する.artifacts領域とfixture・binding出力だけです。大きな質問・ベクトルデータはGit対象外の.dataへ置きます。通常の単体・型・lint検査は、モデルのdownloadや別repoの読み取りを行いません。

## Adapterの責務

VectorClientは、検証したmanifestと、呼出し元が渡す上限付き成果物streamを受け取ります。許可origin、展開後バイト上限、公開単位の識別情報、最新要求だけの描画は呼出し元が制御します。clientは数値handleを隠し、組込みmetadata・methodでtyped arrayをコピーし、準備済みsnapshotを保ちながら失敗したtaskを解放します。

ベクトルの完全探索とモデル推論は別です。[Ruri実験](../experiments/ruri/README.ja.md)が初期の固定ブラウザエンコーダーを担当します。アプリケーション統合では任意機能として保ち、主系の字句検索を利用可能にする必要があります。
