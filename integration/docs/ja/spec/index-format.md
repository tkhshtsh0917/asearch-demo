# 索引形式とサーバー更新

[English](../../spec/index-format.md)

<a id="section-11"></a>

## 11. ASIX v1と配信

ヘッダoffset・section項目・payload型・checksumの正本はRust repoの[バイト単位仕様](https://github.com/tkhshtsh0917/asearch/blob/main/docs/ja/asix-format.md)です。crate分割・native解析・クエリ変換表でもmajor 1／minor 0を維持します。

<a id="section-11-1"></a>

### 11.1 保存するデータと派生データ

1ファイルは1つの不変segmentです。正規化UTF-16 text・長さ・key・orderと、任意のtombstone・原文を保存します。記号ID・block配置・区切り／text／終端mask・EQコンテナはロード時に構築します。変更を文書単位に閉じ込め、実行時のblock幅や派生絶対offsetを配信形式から除きます。正規化文だけのファイルから原文を捏造しません。

<a id="section-11-2"></a>

### 11.2 canonical配置

writerはTEXT・TLEN・KEYS・ORDRと、任意のOLEN・OTXT、昇順かつ一意なTOMBを出力します。型付きpointer castではなくlittle-endianを明示的に復号します。canonical writerは決定的で、原文の正規化結果が保存textと一致することが必須です。

<a id="section-11-3"></a>

### 11.3 順序

文書をorder・keyでcanonical化し、文書内text順を維持します。文書keyの重複は失敗します。サーバー構築・圧縮で同じcanonicalシリアライズを使い、派生検索構造は出力バイトに含めません。

<a id="section-11-4"></a>

### 11.4 ロード

採用前に長さ・offset・整列・section tag／重複・予約欄・記述子・順序・checksum・資源上限を検証します。未知critical sectionは失敗し、検証済みnoncriticalは読み飛ばして再保存時には保持しない場合があります。streamは上限付きヘッダから読み、途中EOF・余剰byteを拒否し、await後にmemory viewを更新して、失敗したreader・準備領域を解放します。

<a id="section-11-5"></a>

### 11.5 互換性

未対応のformat・normalizer版は推測せず拒否します。同じ対応設定・文書集合はbyte単位で同じcanonical出力になります。分割前のgolden segmentと全profile・64正規化設定で互換性を検査します。byte hashは破損を検知し、配信の信頼とは別です。

<a id="section-11-6"></a>

### 11.6 資源上限

| 既定            | 値         |
| --------------- | ---------- |
| maxTotalBytes   | 256 MiB    |
| maxTexts        | 1,000,000  |
| maxUnits        | 10,000,000 |
| maxSlots        | 16,777,216 |
| maxWorkingBytes | 512 MiB    |
| maxPatternUnits | 65,535     |
| maxSegments     | 8          |

上限は正の安全な整数で、maxSegmentsは最大8です。呼び出し元は小さくできます。各textの原文・正規化文は65,535 UTF-16単位以内です。元buffer・復号／派生領域・query／workspace予約・輸送・準備・新旧併存をAPIの所有責務に従って計上します。設定容量の予算であり、プロセス／ブラウザRAMの保証ではありません。失敗時に切り捨てや部分採用を行いません。デモはより厳しいクエリ・作業上限を使います。

<a id="section-20"></a>

## 20. サーバー配信セグメント

<a id="section-20-1"></a>

### 20.1 更新方法の選択

小規模・低頻度ならbase置換、頻繁な更新ならdelta追記と定期圧縮を利用できます。転送・ロード・検索・切り替え費用を測って閾値を選び、engine自体は定期処理を実行しません。

<a id="section-20-2"></a>

### 20.2 文書の変更

upsertは置換後の全texts・orderを持ち、古い同keyを無効にします。削除はtombstoneです。segmentのtombstoneは古いsegmentだけに作用し、自身の置換textを無効にしません。文書の別名は同keyを共有し、順位だけの変更もupsertです。クライアント編集層は使いません。

<a id="section-20-3"></a>

### 20.3 検索と統合

検索前にlive maskが最新keyの所有を解決します。生存文書の別名全体で最小距離を求めます。同じ順位でsegment結果を統合し、上位件数へ絞る前に生存keyを重複排除します。最小level別totalsは正確で要求limitと独立です。位置順位では各segmentと最終統合で同じ開始位置比較を使います。

<a id="section-20-4"></a>

### 20.4 原子的採用

合計上限内で候補byte・記述子をすべて準備・検証します。完全な採用の成功だけがactive状態を置換し、revisionを進めref・cacheを無効にします。準備中も旧状態で検索できます。失敗・中止・解放は列を部分公開しません。複数部分の原子的採用にはreplaceSegmentsを使い、連続addSegmentは単一取引にしません。

<a id="section-20-5"></a>

### 20.5 manifestと圧縮

manifestはformat asearch-manifest/1、indexId、generation、不変のindex記述子、順序付きsegment列を持ちます。indexIdは`[A-Za-z0-9][A-Za-z0-9._-]{0,127}`、generationは正の安全な整数です。正規化・形式・記号単位の変更には新系列と明示的な新索引が必要で、sessionを暗黙移行しません。segment数は1..8で、空コーパスにも0textのbaseを持たせます。

各記述子は小文字16桁XXH3 id・URL・byte数・text数・SHA-384 SRIを持ちます。URLはuserinfoなしの空でないHTTP(S)絶対／相対参照で、解決・origin／CORS・取得は呼び出し元が担当します。expectedは採用前に実際のbytes・texts・idと全体SHA-384を照合します。XXH3は暗号学的真正性ではなく、manifestと転送経路への信頼は呼び出し元が確保します。

`diffManifest`は比較前に両入力を検証します。currentなしはreplace、異なる系列・設定はconflict、古いgenerationはstaleです。同generationはJSON objectのkey順を無視しsegment順を保った規定欄の一致が必須です。新generationではURL移転を許しますが、既知id・bytes・texts・integrityを再定義できません。旧ID列が完全な接頭辞ならappend（変わらなければnone）、それ以外はreplaceです。

呼び出し元はdiff→load→adopt→適用済み完全manifestの保存を直列化します。原子的採用の成功後だけcurrentを更新し、noneでも新generationを保存します。失敗時は再試行のためcurrentを保持します。generation枯渇で折り返しません。

native CLIはJSONLのbuild・delta、manifest生成、圧縮を提供します。upsert入力は`{"op":"upsert","key":1,"texts":["updated"]}`、削除は`{"op":"remove","key":1}`です。ブラウザ編集APIではなくサーバーbuilder操作です。圧縮は実効的な生存文書のcanonical buildと同じbyte列にします。ブラウザWASMにbuilder・compactorはありません。

<a id="section-20-6"></a>

### 20.6 配信の推奨

内容hash付きの不変segment URLと、短寿命・再検証するmanifestを使います。HTTP圧縮はCDN・サーバーで設定・検証し、CLIは圧縮辞書やCDN設定ではなくASIX byteを出力します。loaderは復号済みbody長を検証します。取得・polling・push通知・オフライン保存は呼び出し元が担当します。

<a id="section-20-7"></a>

### 20.7 メモリ

WASM線形メモリは縮みません。全量置換では新旧索引・準備領域が併存するため、容量予算をブラウザRAM全体や固定2倍のpeakと同一視しないでください。適切な場合はWorker置換でWASM instance全体を解放できます。deltaは通常転送量を減らしますが、余裕の実測は必要です。

<a id="section-20-8"></a>

### 20.8 対象外

ブラウザ編集層・upsert／remove／forget API、IntentIndexの差分、Worker間tombstoneプロトコル、manifestのネットワーク処理、永続cache、CDN設定は提供しません。
