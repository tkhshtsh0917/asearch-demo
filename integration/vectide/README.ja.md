# Vectideのブラウザ統合

[English](README.md)

このprivateなTypeScript workspaceは、明示的に指定したnative CLI・raw WASM成果物を利用します。安全なbyte入力、clientに紐付くsnapshot handle、協調型のブラウザ実行制御、独立したnative・WASM適合性検査を担当します。Rustエンジン・builderのsourceは[Vectide](https://github.com/tkhshtsh0917/vectide)に置き、npm packageは公開しません。

## 準備と検査

このディレクトリから、repoで固定するNode.js・pnpm環境を導入して実行します。

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm prepare:assets /path/to/verified-release-bundle
pnpm build
pnpm test:browser chromium
```

パスは明示的な入力であり、隣のcheckoutを推測しません。bundleはrelease.json、SHA256SUMS、native vectide、raw vectide_wasm.wasm、projectのlicenseを含みます。準備でschema、sourceの識別情報、ファイル長、SHA-256を検証し、対応するwasm-bindgen 0.2.129でweb bindingsを生成します。渡されたCLIでbase・delta・圧縮済みfixtureと完全探索の参照結果を作り、Rustはコンパイルしません。sourceに差分のある開発用bundleには明示的な--allow-dirty引数が必要で、製品成果物はcleanなsourceを識別する必要があります。

他のブラウザprofileはfirefox、webkit、android-profile、iphone-profileです。preview portを共有するため順に実行します。nativeとの正確な順位一致、top-k前のfilter、更新・復元、handleの所有、不正入力、typed-arrayサブクラス・独自getter、detach済みbuffer、キャンセル、回復を検査します。モバイルprofileはhost上のエミュレーションであり、実機やブラウザ推論のメモリを保証しません。

成果物コマンドが置き換えるのは、自身が生成する.artifacts領域とfixture・binding出力だけです。大きな質問・ベクトルデータはGit対象外の.dataへ置きます。通常の単体・型・lint検査は、モデルのdownloadや別repoの読み取りを行いません。

コーパスのツールは、ルートのtoolsにある依存パッケージ不要の抽出・HTTP rangeヘルパーを再利用します。reader固有の型は、このworkspace自身の`hyparquet`依存を使って呼出し側で検査するため、独立した検査にリポジトリルートのnode_modulesは不要です。これらの共有ヘルパーの変更時もconsumer workflowを実行します。

## Adapterの責務

VectorClientは、検証したmanifestと、呼出し元が渡す上限付き成果物streamを受け取ります。許可origin、展開後バイト上限、公開単位の識別情報、最新要求だけの描画は呼出し元が制御します。clientは数値handleを隠し、組込みmetadata・methodでtyped arrayをコピーし、準備済みsnapshotを保ちながら失敗したtaskを解放します。

ベクトルの完全探索とモデル推論は別です。[Ruri実験](../experiments/ruri/README.ja.md)が初期の固定ブラウザエンコーダーを担当します。アプリケーション統合では任意機能として保ち、主系の字句検索を利用可能にする必要があります。

ブラウザ回帰では、上限内の未完了uploadを使ってmoduleの512 MiBのlinear memory上限を意図的に使い切ります。失敗したfallible allocationはstagingを消去し、保持するupload予約領域を解放した後、正常なクエリを再度実行できる必要があります。これはホストブラウザのprocess memory保証とは区別します。

## native文書ベクトルと5万件のベンチマーク入力

`node tools/corpus.ts`はcorpus.lock.jsonの不変な先頭50,000質問を上限付きHTTP Rangeで取得し、実体化した部分集合全体のSHA-256を確認します。Parquet shard全体を検証したとは主張しません。このCC BY-SA 4.0の派生物は、元dataset・revision・licenseのpinを保持します。回答や元の本文は埋め込みません。

```sh
mise exec -- uv run --script --locked tools/embed.py --input .data/wiki50k-questions.jsonl --output .data/vectors.jsonl --limit 50000
python3 -m unittest discover -s tools -p 'test_*.py'
```

固定したnative F32 encoderは`text`だけを使い、文書prefixを加え、切り詰めずに全件のtoken数を確認し、安定IDと256座標を出力します。消費した入力、model・script・Python lockのdigestと計測条件を記録します。出力とstagingは既存ファイルを上書きできません。offlineのI/OテストはML runtimeをimportしません。計測hostでは5万文書が74.41秒、最大87 tokenで、固定した256 tokenの方針内でした。これはサーバーでのencodingの観測で、ブラウザのクエリ遅延や移植可能なthroughput保証ではありません。

## 協調スケジュールの計測

`tools/bench.ts BUILD_DIRECTORY LABEL`は、明示的にビルドしたadapterを1万件のnative oracleで測り、実際のJS/WASM hashを記録します。読み込みとクエリの協調yieldを含み、encodingは含みません。5回のwarmup後に同じクエリを40回実行します。同じWASM・データによるChromiumの逐次確認では、timerによるyieldはクエリp95が200.8 ms、準備が1185.4 ms、MessageChannelはp95が1.9 ms、準備が196.5 msでした。host上の観測はadapterのスケジュールを分離したもので、modelの遅延や移植可能な端末保証ではありません。portはclientが所有し、queueは同時に存在しうる2つのtaskのyieldに制限し、disposeは待機yieldを解決してからportを閉じます。キャンセル・予算・正確なoracle一致の検証も維持します。

release bundleには`THIRD-PARTY-NOTICES.txt`も含めます。準備は指定された5ファイルを全て検証してから実行し、bindings/native oracleを有効な出力とは別に準備し、install失敗時は全出力ディレクトリを戻します。破損bundleや生成失敗の後もsource/binding/fixture出力を利用できます。`node tools/prepare-bench.ts EXPLICIT_BASE_MANIFEST`は1万・5万件それぞれの固定scalarクエリとnative oracleを準備します。tools/bench.tsの4番目の引数に行数を渡し、5万件のブラウザ実行では明示的なexpanded profileを使用します。

vector consumerのPR workflowは、Torch・Sentence Transformers・model取得を含まない独立した環境で、RuffとPython標準ライブラリのI/O回帰も実行します。ローカルの`mise run check-python`も同じlint・format・offline unittestを実行します。native modelの埋め込みは、別途lockしたuvの操作のままです。
