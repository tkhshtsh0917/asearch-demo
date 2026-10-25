# 検証と計測

[English](../../spec/validation.md)

<a id="section-14"></a>

## 14. 正しさの範囲

最適化実装の別コピーだけではなく、hash付き上流fixtureと独立した費用行列・整列モデルを使います。空・空白入力、長さ境界、正規化、大小文字、サロゲート対・孤立単位、全対応mode・profile・K、破損ASIX、overflow、小予算、stream、解放、callback／getter、更新、決定的byteを検査します。

nativeの確保計数で準備済み照合のheap確保ゼロを検査します。JS／WASM転送・結果コピー・更新・初回検索準備は含みません。形式・意図のfuzzは有限の頑健性検査で、証明ではありません。ブラウザは実際の読み取り専用WASMを使い、native CLIのfixture生成はruntime・計測区間の外です。OSAなど未実装engineを製品の検証済み機能とは主張しません。

<a id="section-14-1"></a>

### 14.1 受入ID

IDは要件名で、テストファイル名ではありません。報告には実際のコマンド・件数・未検証条件を示します。

| ID  | 範囲                                                                                          |
| --- | --------------------------------------------------------------------------------------------- |
| C0  | source／lib fixture、上流assertion、README例、意図的逸脱、公開型、native互換の確保検査。      |
| I0  | 初期化試行・並行init・古いready・再試行／失敗・Node ESM／CJS・Worker・独立pack配布物。        |
| P1  | 同じ結果のAB／BA比較、合成ノイズ／回帰の分類、再現できる集計。                                |
| Q2  | K境界・wrap／正規化／空白／非BMP・limit 0・空入力・厳密なoption・一意key順位／総数。          |
| R2  | 小さいbyte／text／slot／作業上限・overflow・長文／空text・reader失敗・準備解放。              |
| F2  | 決定性・サーバーfixture byte・critical／noncritical section・予約／checksum／配置・形式fuzz。 |
| S3  | 正規化後接頭辞・削除・K増加・mode変化・上位外候補・退避／fallback・全量同値。                 |
| U4  | 準備中の旧状態検索・BUSY・free／中止・失敗保持・session・segment・予算。                      |
| M4  | 系列／設定／世代の競合・古い更新・SRI・none時世代更新・原子的manifest再試行。                 |
| E5  | 原文UTF-16写像・かな／濁点／幅・決定的同点・コピー／古い／別所有元ref。                       |
| D6  | DAG対小規模全展開・指数的選択・上限付き文法／深さ／node・最良展開。                           |
| O7  | 任意engineの採否記録。採用kernelには同値性・機能検出／fallback・安全性・条件付き効果が必須。  |

クエリ変換表には、語単位・否定・曖昧な形、元の一致を優先するfallback、混在composition、共有する配信snapshot、上限を追加検査します。位置順位には独立した部分文字列oracle、上位制限前の全別名、startsのコピー、shard mode、更新、遷移予算からの回復を検査します。デモは初期・差分・圧縮・復元・再起動、ラベル、スマホ配置を検証します。

<a id="section-15"></a>

## 15. 性能計測

<a id="section-15-1"></a>

### 15.1 負荷と指標

固定の実・合成コーパス、日本語・ASCII・非BMP・wildcard、誤字query、IMEのような置換列を使います。照合・初回利用可能・ロード／更新・サーバー構築・線形メモリ・転送／WASMサイズを分けて測ります。単発boolean、全コーパス最小level上位件数、session、lifecycleは別負荷です。結果・意味論が違えば速度比の主張は無効です。

<a id="section-15-1-1"></a>

### 15.1.1 paired回帰判断

- profile・normalizer・mode／wrap・K・limit・countTotal・ranking・コーパス・seed・要求列を固定し、計測前に結果を照合します。比較する実装commitとハーネスcommitを記録します。
- 同じホスト・ブラウザでbaseline／candidateをAB／BA交互に実行します。warmup・cacheを揃えた独立5 paired run以上を使い、宣言した境界でsessionをresetします。ビルド・テスト・他の計測を並行しません。
- 各runはwarmup後30標本以上です。個別打鍵p95は構成ごと100打鍵以上、p99は1,000以上が必要ですが、統計精度を保証する件数ではありません。操作を束ねた分布はbatch平均であり、個別打鍵のpercentileではありません。
- candidate／baseline中央値比の幾何平均と、固定seed・10,000再標本のpaired bootstrap 95%区間を使います。下限が1.10を超える場合だけ回帰候補です。独立5ペアの別組を繰り返し、両方で条件成立した場合だけ確定します。他は未確定と報告し、都合のよいrunを選びません。
- 共有CIは正しさ・型・format／lint・buildを必須とし、不安定な時間閾値を設けません。条件を制御するrelease計測は性能判断に使え、専用runnerにも同じ規則を適用します。
- raw標本・seed・負荷hash・ソース／ハーネスcommit・依存・ブラウザ／コンパイラー・OS／CPU・timer・集計コードを保持します。WASM線形メモリ、Rust容量予算、JS／プロセスメモリを分け、未取得指標を明示します。

<a id="section-15-2"></a>

### 15.2 解釈

代理prototypeや古いコーパス形状を製品保証に使いません。DP行だけでなく抽出・転送・ロード・更新を含めます。位置順位は意図的に順序を変えて処理を増やすため、同じ結果の最適化比較とは分けて追加費用を記録します。[計測手順](../../../tools/bench/README.ja.md)と[性能判断](../performance.md)を参照してください。

fixture生成では固定版esbuildで移植元のTypeScript oracleを変換し、TypeScriptコンパイラのJavaScript APIには依存しません。再生成後も、チェックインした互換fixtureのバイト列が変わらないことを要求します。プロジェクトの型検査には引き続きTypeScript 7を使います。
