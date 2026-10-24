# 配置と照合エンジン

[English](../../spec/engines.md)

<a id="section-3"></a>

## 3. コーパス表現

<a id="section-3-1"></a>

### 3.1 記号

profileによりtextをコードポイントまたはUTF-16で走査します。孤立サロゲートは元単位の値を維持します。queryリテラルを元記号・小文字・大文字キーで1回コンパイルし、密なコーパスIDへ解決します。ID 0は存在しない記号で、一致には使いません。native RustとホストJSの大小文字変換は別の入力です。

<a id="section-3-2"></a>

### 3.2 block整列スロット

各textは境界slotと記号列を持ち、区切り・text・終端のmask、guard・paddingを置きます。blockはu64語に整列し、長いtextには拡張blockを使う場合があります。canonical順は文書order・key、入力text順です。実行時block幅はASIXへ保存しません。ENDの累積件数で受理bitからtext IDへ対応付けます。

<a id="section-3-3"></a>

### 3.3 EQコンテナ

記号ごとの出現はu16 offset配列または65,536 slotの密bitmapで保持し、4,096出現を境界に選びます。block内で上限8行のEQ cacheを再利用します。同じリテラルはmaskを共有し、queryの異なる全記号に比例してcacheを増やしません。

<a id="section-4"></a>

## 4. 転置blocked照合

<a id="section-4-1"></a>

### 4.1 向き

従来Bitapはbitをpattern位置に割り当てtext記号で走査します。このengineはbitをコーパスslotに割り当てpattern行で走査します。S[i][e]は接頭辞費用がe以下の全slotです。一括は単調なIdeal費用を使い、profile差は非単調な受理ではなくtext単位の選択に適用します。

<a id="section-4-2"></a>

### 4.2 漸化式

shは語間carry付きでslot増加方向へ移動します。SEPでtext境界を初期化し、TXTでfillをtext slot内に制限します。以下は多語シフト・加算と、単調な初期境界i<=eを使います。

```text
row 0: X = e>0 ? sh(S[0][e-1]) : 0
row i: X = (sh(S[i-1][e]) & EQ_i)
         | (e>0 ? sh(S[i-1][e-1]) | S[i-1][e-1] | sh(S[i][e-1]) : 0)
X = (X & ~SEP) | (i<=e ? SEP : 0)
S[i][e] = i in LOOPS ? fill(X) : X
accept at text k iff END_k is set in S[m][e]

y = (x & TXT) | (sh(x & SEP) & TXT)
f = (((y + TXT) ^ TXT) & TXT) | y
fill(x) = f | (x & SEP)
```

<a id="section-4-3"></a>

### 4.3 無料ループのfill

carryによる処理で、到達したtext slotからそのtext終端までを埋めます。境界・死padding・guardがcarryを吸収し、別textへまたがる一致を防ぎます。長文・block端で語間算術を検査します。

<a id="section-4-4"></a>

### 4.4 抽出

一致する全textの最小levelを記録します。抽出は関連する全別名を走査し、生存文書ごとの最良hitを選んで一意keyを数えます。既定抽出はcanonical文書順のlevel別出力です。位置順位は全生存一致の始端を求め、完全な文書候補を整列してから上位件数へ絞ります。安全なplannerの記録のため死行を捕捉する場合も、生存hitにはしません。総数はtextの単純popcountではなく、上位件数と独立です。segment統合も同じ比較を使います。

<a id="section-4-5"></a>

### 4.5 block実行

再利用する2つの状態bufferでblockの行を保持します。初期境界から復活しない段階で最大levelの行が空なら、そのblockを早期終了します。K=0..3を専用化し、4..7は動的ループです。利用前にworkspaceの所有・容量・記述子を検証します。準備済みnative照合はheap確保を行わず、輸送・出力コピーは別です。

<a id="section-4-6"></a>

### 4.6 任意engine

OSA・Myers・SIMD・NodeAsearchは選択可能なランタイムengineではありません。提案段階の項をこの漸化式へ加えたり、実装済みと表示したりしません。採用には独立した同値性と条件を制御した計測が必要です。

<a id="section-4-7"></a>

### 4.7 増分行

SearchSessionは正規化後の共通接頭辞行のcheckpointを上限付きで保持します。class・mode・wrap・Kの変化には検証した再利用・fallback条件を使います。退避済み／利用不可なら安全にblocked計算へ戻ります。cache予約を全root・session・segmentと合算し、query長で保持状態が無制限に増えないようにします。

<a id="section-5"></a>

## 5. スカラー照合

ScalarWmはnative照合で汎用語幅と再利用workspaceを扱います。互換経路は別に折り返すu32意味論を維持します。小さい完全候補集合には63リテラルまでの上限付きbit並列kernelを使い、それ以外は再利用するスカラーDP行です。走査前に全キー集合maskを解決し、NUL・非BMP・孤立サロゲートを回帰検査します。

<a id="section-6"></a>

## 6. 安全な絞り込み

<a id="section-6-1"></a>

### 6.1 前提

上位件数外の別名を含む前回の完全な一致text集合を使います。証明できるリテラル拡張、互換なloop・mode・class、K非増加が必須です。削除・正規化／大小文字の変化・安全でないwildcard編集・K増加では安全な広い検索へ戻ります。切り捨て・容量超過の候補を完全と扱いません。

<a id="section-6-2"></a>

### 6.2 planner

候補単位の総数を全量コーパス経路と保守的に比較します。十分小さい完全候補だけをスカラー評価し、他はblocked・incrementalを維持します。autoと明示transposed-blockedは計画が異なり、一致結果は変えません。maxCacheBytes=0はcheckpointを無効にしますが、別予算の絞り込みは禁止しません。

<a id="section-7"></a>

## 7. 意図DAG

<a id="section-7-1"></a>

### 7.1 文法と上限

リテラル・group・選択・直前要素の省略・backslash escapeを扱います。star・plusの閉路や不正文法を拒否します。例は`(保存|更新)(する)?`です。再帰下降は明示groupだけをたどり、深さ64に制限します。元の式は65,535 UTF-16単位以内で、増加前にnode・edge・正規化状態のquotaと作業予算を検証します。

<a id="section-7-2"></a>

### 7.2 照合

現行実装はDAG×patternの最小費用行列で、最短・最長記号長からentryを除外します。正規化・サロゲート処理は文法境界をまたぐ有限の保留状態を維持します。指数的な文字列集合を列挙せず、黙って切り捨てません。提案された状態語のOR統合は現行ランタイムのalgorithmではありません。小規模全展開oracleと指数的選択肢のテストで同値性を検証します。

<a id="section-7-3"></a>

### 7.3 説明

要求したhitは上限付き経路復元で実際の最良展開とハイライトを返します。選択した正規化前の展開を復元できる場合だけ原文座標にし、そうでなければ正規化座標を明示します。IntentIndexは固有の既定順位を使い、位置順位・segment差分には対応しません。
