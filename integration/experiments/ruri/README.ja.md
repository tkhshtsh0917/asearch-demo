# Ruriブラウザエンコーダー試験

[English](README.md)

cl-nagoya/ruri-v3-30mの独立したCPU/WASM実現性実験です。公開デモの変更やベクトルストアの実装は行いません。クエリは専用のブラウザWorker内で処理します。モデルとtokenizerはmodel.lock.jsonで固定し、生成した成果物と時間計測記録はGit対象外にします。

実装では@mlc-ai/web-tokenizers 0.1.6とONNX Runtime Web 1.31.1を直接使い、同じインストール済みpackageのruntime JS・WASMを揃えます。[公式Ruriカード](https://huggingface.co/cl-nagoya/ruri-v3-30m)は、256次元、検索の役割別prefix、prefix tokenを含むmean poolingを定義します。[コミュニティのONNX変換](https://huggingface.co/onnx-community/ruri-v3-30m-ONNX)は別成果物です。以下のnative F32比較で採用profileの条件を定めます。

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
- warm runnerはlocalhostから読み込み、route制御でHTTP cacheを無効化します。native参照への忠実度、検索品質、起動・cache条件は別runnerで計測します。実機モバイル性能は計測せず、モバイルprofileはホスト端末上でlayout・device設定をエミュレートします。

時間記録はsource・model・runtimeの識別情報と明示的な条件を持ちます。bundleにsource fingerprintを埋め込み、runnerが古いbuildやsourceの変更を拒否します。native参照もscript、環境lock、入力hashを識別します。ブラウザ推論の固定の待ち時間保証はありません。操作全体の計測はアプリケーション統合で行います。

## native互換性と検索品質

モデル準備とbundle構築後、このディレクトリから実行します。

```sh
mise install
mise exec -- uv run --locked --python 3.13 --script tools/reference.py reference-inputs.json results/native-reference.json
pnpm test:parity
pnpm prepare:quality
mise exec -- uv run --locked --python 3.13 --script tools/reference.py .reference/quality/source.json results/quality-reference.json
pnpm test:quality
mise run check-reference
```

独立したnative経路は固定したSentence Transformers・PyTorchのCPU F32推論を使います。クエリ・文書のanchor 12件には改行と文字種の混在を含みます。全token IDが一致し、計測集合のQ8・native間cosineは0.9936以上です。Rust/WASM tokenizerは、以前のJS tokenizerで欠けていたbyte fallbackを維持します。

quality.lock.jsonは、[JMTEB](https://huggingface.co/datasets/sbintuitions/JMTEB)が配布するCC BY 4.0のJaGovFaqsサブセットを固定します。token上限に収まる決定的な選択は、native F32文書ベクトルによる1,000文書・正解付き128クエリです。ブラウザQ8のRecall@10は94.5%、native F32は95.3%で、Recall@10とnDCG@10の低下は固定した絶対値0.02のゲート内です。これは固定サブセットでの量子化の回帰検査であり、JMTEB全体の性能、デモの救済品質、回答なしの判定精度を示しません。データ準備は明示的なネットワーク操作です。

## 起動・cache・採用判断

```sh
pnpm bench:startup chromium --throttle
pnpm bench:startup firefox
pnpm bench:startup webkit
```

起動用serverは--throttle時、全要求で10 Mbpsの展開後body上限を共有し、最初のbyteまで80 msの遅延を加えます。固定したローカルファイルをHTTP圧縮なしで配信します。試験は1時間のHTTP cacheを有効にし、warm runnerは意図的に別のcache条件を使います。Chromiumの初回準備sampleは、要求ファイル約63.45 MBに対して約52秒でした。model・runtime成果物を保存済みで新しいWorkerを作る場合は約0.35秒でした。1台のhostで各profile 100要求のwarm推論p95は7〜8 msでした。これらはinternetや実機端末での保証ではありません。

任意のIndexedDB cacheは、hashをkeyとするmodel・runtimeのBlob 6件、展開後58,627,558バイトを、64 MiB・16entryの保存上限内に格納します。読み出し時に長さとdigestを検証し、同サイズの破損も固定sourceから置き換えます。保存エラーやquota拒否では検証付きfetchへ戻り、クエリ履歴は保存しません。fetchedDecodedBytesはブラウザHTTP cacheの応答も含むfetch bodyのバイト数であり、回線上の転送量ではありません。

記録する実験の目標は、cold準備90秒、保存済みからの初期化10秒、warm往復100 ms、新規の展開後資源64 MiB、ブラウザ子process群のRSS合計1 GiBです。全条件は満たしていません。FirefoxはRSS目標を超え、試験環境のWebKitではBlob保存がUnknownErrorで失敗しますが、推論は継続します。macOSではWebKitのcontent processが計測する子process群の外で起動することがあり、比較可能なRSS全体は取得できません。RSS計測は共有pageを重複計上したりpeakを逃したりする可能性があります。--require-budgetは記録保存後に未達・不明の目標を失敗にします。

ブラウザでのベクトル化は明示的に有効化する実験機能として維持します。字句検索を利用可能に保ち、読み込み・利用不可状態を示します。modelを自動downloadしたり、全ブラウザでメモリ条件を満たしたと主張したりしません。ベクトルストア本体には、独立した上限付き資源検査とブラウザ検査があります。

## 帰属

上流モデルと選択したONNX変換はApache-2.0を宣言しています。成果物を再配布する際は、model cardの帰属とlicense要件を維持してください。Web TokenizersとONNX Runtimeは各依存のlicenseに従います。モデルweightsをsource Gitに格納しません。

encoder WorkerはPagesのパスprefix配下でアプリから再利用できるよう、同一originのディレクトリbaseを受け取ります。応答にはimportしたmodel/runtime profileそのもののSHA-256を含めます。初期化失敗時はtokenizerを解放し、encoder/probeのdisposeは冪等です。固定資産のredirectは拒否します。startup記録では初期化・初回推論・その後のwarm推論を分け、coldの判定には初回推論を含めます。過去のreadyまでの観測を、完全な初回利用の遅延と言い換えることはありません。
