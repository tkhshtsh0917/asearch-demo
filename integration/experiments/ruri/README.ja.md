# Ruriブラウザエンコーダー試験

[English](README.md)

cl-nagoya/ruri-v3-30mの独立したCPU/WASM実現性実験です。公開デモの変更やベクトルストアの実装は行いません。クエリは専用のブラウザWorker内で処理します。モデルとtokenizerはmodel.lock.jsonで固定し、生成した成果物と時間計測記録はGit対象外にします。

初期実装では@huggingface/tokenizers 0.2.0とONNX Runtime Web 1.31.1を直接使い、同じインストール済みpackageのruntime JS・WASMを揃えます。[公式Ruriカード](https://huggingface.co/cl-nagoya/ruri-v3-30m)は、256次元、検索の役割別prefix、prefix tokenを含むmean poolingを定義します。[コミュニティのONNX変換](https://huggingface.co/onnx-community/ruri-v3-30m-ONNX)は別成果物であり、native F32推論との品質比較は引き続き必要です。

## 実行

repoルートから、miseの固定環境で実行します。

```sh
mise exec -- pnpm --dir integration/experiments/ruri install --frozen-lockfile
mise exec -- pnpm --dir integration/experiments/ruri prepare:model
mise exec -- pnpm --dir integration/experiments/ruri check
mise exec -- pnpm --dir integration/experiments/ruri build
mise exec -- pnpm --dir integration/experiments/ruri bench chromium
```

モデル準備は、ハッシュを検証する成果物を明示的にダウンロードします。通常の単体テストはオフラインであり、成果物を必要としません。計測前に対応するPlaywrightブラウザを導入してください。他のprofileはfirefox、webkit、android-profile、iphone-profileです。ローカルpreviewポートを共有するため、順番に実行します。手動入力では、準備後にdevコマンドを使います。

専用CI workflowは、モデルを取得せず、整形・lint、型検査、オフライン単体テスト、bundleのコンパイル、依存監査を行います。週次の依存監査とDependabotも、この独立packageを対象にします。実モデルでのブラウザ計測は、明示的なローカルコマンドとして維持します。

## 契約と計測範囲

- クエリに`検索クエリ: `、索引文書に`検索文書: `を使い、ASCIIのcolonと末尾spaceを維持します。
- attention maskで選ぶtokenをprefix・special tokenも含めてmean poolingし、F64演算で単位長に正規化してF32へ丸めます。
- 固定したq8変換を使います。この試験は4096 UTF-8バイト、またはprefix・special tokenを含め256 tokenを超える入力を、暗黙に切り詰めず拒否します。モデルが対応するcontext長より意図的に小さくしています。
- モデルファイルの合計は43,778,706バイトであり、runtime成果物とsessionメモリは別です。Q8のweightsであることは、出力ベクトルがint8であることを意味しません。
- 同時に実行する推論は1つです。要求はtimeout時にWorkerを再作成し、通常の入力検証エラー後は読み込み済みsessionを再利用できます。これは逐次的な試験であり、製品の最新クエリアダプターではありません。
- runnerは、有限・単位長の256次元のクエリ・文書出力、空・token上限超過のクエリ後の回復、静的成果物だけの通信を検証します。検証後に5件のwarm-upと100件のwarm計測を、sampleごとのtoken数とベクトルhashとともに記録し、初回推論は別に記録します。
- 成果物はlocalhostから読み込み、要求のroute制御によりHTTP cacheを無効化します。実際のinternet上のモデルdownload、永続cacheからの初期化、検索UI全体の待ち時間、native参照実装への忠実度、実機モバイル性能は計測しません。モバイルprofileはホスト端末上でlayout・device設定をエミュレートします。

時間記録はsource・model・runtimeの識別情報と明示的な条件を持ちます。E0は予備的な根拠とし、品質・cache・メモリ・全体のゲートは引き続き必要です。ブラウザ推論の固定の待ち時間保証はありません。

## 帰属

上流モデルと選択したONNX変換はApache-2.0を宣言しています。成果物を再配布する際は、model cardの帰属とlicense要件を維持してください。Tokenizers.jsとONNX Runtimeは各依存のlicenseに従います。モデルweightsをsource Gitに格納しません。
