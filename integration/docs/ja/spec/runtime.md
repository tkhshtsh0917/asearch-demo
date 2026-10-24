# 現行ランタイムと配信の契約

[English](../../spec/runtime.md)

Rustのasearch-indexはASIX v1の検証・記述子・正規化を担当します。asearch-builderは検索engineを作らずcanonicalなbase・deltaのbyteを生成します。asearch-engineはsegmentのロード・検索と、任意のnative builder補助を提供します。既定WASMはそのfeatureを無効にし、builder・analyzerに依存しません。asearch-analyzerはCLI経由でサーバー専用Sudachi解析・クエリ変換表を生成します。

ブラウザ・NodeのWASMはAsearchIndex.fromBytes／fromStream、検索、session、説明、原子的segment採用を公開します。runtimeにfromDocs・fromStrings・buildIndex・buildDelta・toBytesはありません。IntentIndexの独立した上限付きDAG構築は維持します。[API参照](api.md)とパッケージREADMEがこの対応範囲を説明します。

回帰テストの準備は検証済みRelease CLIを呼びます。Nodeアダプターとloopbackブラウザfixtureはtests/fixturesに置き、pack配布物から除きます。ロード・検索・解放・検証・更新には実際の読み取り専用WASMを使い続け、シリアライズのassertionはサーバー実装を検証します。

ASIX major 1／minor 0を維持します。分割前golden segmentと全profile・64正規化設定で互換性を守ります。CLIのbuild-flatはfixture・サーバー用に上限付きUTF-16列と版1の数値設定を受け、通常のアプリはJSONLのbuild・deltaを使います。CLIの検索・圧縮・manifestはASIX記述子を読み、code-pointにはIdeal、UTF-16にはasearch.ts-libのqueryを使います。符号化・サイズ計算はtext・単位・file上限を検証します。

クライアント計測はロード・検索・更新を対象にし、サーバーのfixture生成・圧縮は区間外です。loopback fixture serverのJSON上限は64 MiBで、超過413、不正文400、builder失敗422を返し、serverを終了しません。

Rust 0.3以降は、一致判定・ASIX byteを変えず任意の位置順位を加えます。デモは全配信段階と同じnative解析snapshotから生成した、上限付き・digest検証済みクエリ変換表を使います。ブラウザは検索変換・再試行を行い、Sudachi解析は行いません。制限は[デモの解析ガイド](../../../../docs/search-analysis.md)を参照してください。
