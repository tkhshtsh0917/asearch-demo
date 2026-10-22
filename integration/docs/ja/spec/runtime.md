# 現行ランタイムと配信の契約

[原文](../../spec/runtime.md) · 日本語版

現在のcrateとAPIの責務、読み取り専用WASM、CLI生成、fixtureと配信の契約を定めます。最初に読む仕様です。

`asearch-index`はASIX v1の検証・記述子・共通正規化を担当します。`asearch-builder`は検索エンジンを作らずにbase/deltaの決定的なバイト列を生成します。`asearch-engine`はセグメントをロードして検索します。任意の`builder` featureでネイティブの保存APIを維持しますが、WASMではこのfeatureを無効にし、builder crateへ依存しません。

CLIは索引の生成・圧縮・manifest生成を担当します。ブラウザとNodeのWASM APIは`AsearchIndex.fromBytes/fromStream`、検索、セッション、説明、セグメントの原子的な採用を公開します。`fromDocs`、`fromStrings`、`buildIndex`、`buildDelta`、`toBytes`はランタイムAPIにありません。IntentIndex独自のDAG構築APIは引き続き利用できます。

回帰テストの準備では、検証済みReleaseのCLIを起動します。Nodeの補助処理は`tests/fixtures`に置き、ブラウザのloopbackハーネスも同じCLIでfixtureを生成します。補助処理は配布パッケージに含めません。ロード、検索、解放、入力検証、更新には実際の読み取り専用WASMを使います。シリアライズの検証はサーバー側実装の責務です。

[api.md](api.md)と[compatibility.md](compatibility.md)にある過去のAPI案は設計記録です。現在サポートする範囲は、この契約とパッケージREADMEで定めます。

ASIX major 1/minor 0は変更していません。crate分割前のgoldenセグメントと、全profile・64通りの正規化設定によってバイト互換性を検証します。CLIの`build-flat INPUT_JSON OUTPUT_ASIX`はfixtureやサーバー連携向けに、上限付きUTF-16列と版1の数値設定を受け付けます。通常のアプリケーションはJSONLの`build`と`delta`を使います。

クライアントのベンチマークはロード・検索・更新だけを計時します。サーバーでのfixture生成と圧縮は計時区間外であり、ブラウザ上の圧縮性能を示す値ではありません。

CLIの検索・圧縮・manifest生成は、ASIXに記録された記号単位と正規化器の記述子を読みます。code pointのセグメントはIdeal、UTF-16のセグメントはasearch.ts-libの検索語profileを使います。Rustの公開エンコードAPIとサイズ計算は、ファイル容量に加えてtext数・正規化単位数の上限を検査します。

loopbackのfixtureサーバーはCLIと同じ64 MiBまでのJSONを受け付けます。容量超過は413、不正なリクエストは400、生成失敗は422を返し、サーバーを終了させません。fixture生成はクライアントの計時区間に含めません。
