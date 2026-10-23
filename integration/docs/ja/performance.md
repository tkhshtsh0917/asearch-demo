# セッション性能の変更前後比較

[English](../performance.md)

明示的に準備した2つの配布物を、同じASIXとengineで比較します。

```sh
node tools/bench/compare-session.mjs BASELINE_DIST CANDIDATE_DIST INPUT_ASIX OUTPUT_JSON BASELINE_COMMIT CANDIDATE_COMMIT auto node
```

integration workspaceから実行します。配布物のディレクトリには`node.mjs`と、生成済みの`node/`のグルー・WASMが必要です。commitには元ソースの40桁IDを渡し、指定した成果物との対応は実行者が確認してください。`auto`を`transposed-blocked`へ変えると全量検索の変更を比較できます。ビルド・fixture準備は計時前に済ませ、テストやビルドを並行実行しません。

5回のpaired runでAB/BA順を交互にし、入力系列ごとにresetします。ids・levels・orders・厳密totalsを各updateの計時外で照合します。JS/WASMの輸送・結果コピーを含むpublic APIの時間であり、ロード・reset・通信・描画は含みません。別の配布物はそれぞれ独立したindexとsessionを所有します。成果物・コーパス・ハーネスのhash、ソースのラベル、runtime情報、個別のraw標本を保存し、ファイルパスは記録しません。

時計による0ms標本は保持します。時計の有効分解能より小さい分位点は判定不能です。このrunnerは観測値を出し、自動的な採用判定は行いません。独立した再計測で改善を確認し、中央値とtailの悪化も調べてください。内蔵の短い入力系列は回帰用であり、すべての検索語を代表しません。既存の`session.mjs`は同じ配布物のblockedとautoを比較するため、目的が異なります。

末尾の`node`を`browser`へ変えると、Chromium・Firefox・WebKitを順に測定します。両配布物は別々のlocalhostモジュールURLで配信し、指定したwebエントリー・生成グルー・WASMのファイル名だけを公開します。取得したASIXのdigestを計測前に照合します。

任意の末尾引数`WORKLOAD_JSON`には、`inputs`（検索語文字列の配列を並べた系列）、`kind`（`session`または`search`）、`runs`、`rounds`、`warmup`を指定できます。両版へ同じ設定を渡します。`kind: "search"`はsession cacheを使わない独立したindex.searchを測ります。ファイルは1 MiB以下に制限しhashを記録します。`tools/bench/query-sequences.mjs`の`querySequences(texts, seed, count)`は、接頭辞・削除・置換・resetとUnicode・wildcardの固定系列を生成します。調整用と確認用で異なるseedを固定し、コーパスの識別情報も別途記録してください。同じ系列の反復数を、独立した検索語の網羅数とは数えません。

回帰テストでは、Node ESM/CJSと3ブラウザで実際のNarrowingを31/32・63/64/65個のリテラル位置にまたがって実行します。ids・最小level・order・厳密totalsを全量検索と照合し、スカラーkernelと長い検索語のfallbackを確認します。

## 適用条件と記録

すべての比較で`mode: 2`（WildcardSpace）、`wrap: true`、`countTotal: true`、`limit: 30`、`maxAmbig: { kind: "by-length", every: 4, max: 3, unit: "profile", includeWildcards: false }`を明示します。説明比較だけは`limit`を指定した`count`へ変えます。両側へ`auto`を含む選択engineも明示するため、配布物の検索の既定値に計測条件を任せません。ロード検証の検索と説明対象の準備にも、計時外で同じ固定条件を使います。

`searchOptions.baseline`と`searchOptions.candidate`は公開APIに渡した設定そのものを保存し、session runnerの従来の説明用`options`フィールドを置き換えます。load/batchの`options`は反復回数を、`iterations`はバッチ内の呼出回数を引き続き記録します。設定helperもハーネスhashの対象です。異なるengine名は意図的な実行戦略の比較であり、版間比較では同じengineを選んでください。固定条件を扱えない版では、暗黙のfallbackをせず失敗させます。

採用したチューニングの測定では、両配布物の既定値がこの固定条件と一致していました。既報の効果は条件付きの過去の観測であり、今回のrunner修正は今後の条件を明示するものです。同一成果物同士の検証実行はハーネスの確認であり、コード変更の高速化を示す測定ではありません。

## ロードと短時間操作の比較

同じrunnerで`kind: "load"`を指定すると、expectedのSHA-384検査を含むメモリ上の`fromBytes`を計時する。指定ASIXからdescriptorを作り、検索結果の照合と解放は計時外で行う。検証と派生構造構築の費用を測り、モジュール初期化・HTTP通信・描画は含めない。指定例：

```json
{ "kind": "load", "runs": 5, "rounds": 10, "warmup": 3 }
```

ブラウザの時計分解能より短い操作には`kind: "narrow-batch"`を使う。計時外でresetとprimeを行った後、公開session.updateを反復する。`primer`・`pattern`・`iterations`（既定512）を指定する。prime後の最初の対象クエリと最後の結果は版間で一致し、narrowing経路を選択する必要がある。コーパスやKポリシーの変化が不適切なら測定を失敗させる。これはwarm状態での同一クエリ反復であり、打鍵系列ではない。標本は**update当たりのバッチ平均ms**と表記し、個別打鍵の分位点と呼ばない。

どの操作でも0ms標本、rawのpaired runs、AB/BA順を保持する。load/batchの要約では100標本未満のp95、1,000標本未満のp99を省略する。`statistics.mjs`の`pairedInterval`でrun全体を再標本化し、中央値が正の場合だけ比率を求める。独立processで再確認し、少数バッチからtailの確実性を推論しない。成果物hashは計測bytesを識別するが、source commitラベルだけでは来歴の証明にならない。

session・segmentの要約でも100標本未満のp95、1,000標本未満のp99を省略する。この最小件数だけでtailの精度を保証せず、run間変動と時計の0ms標本を確認する。

`kind: "explain"`には`pattern`・`count`（1/5/20）・`iterations`（既定32）を指定できる。両索引で同じ条件の検索を先に行い、ids/levels/orders/exact totalsを照合する。opaqueなrefは各版が自身のものを使う。その順位の結果群への公開`explain`呼出しをバッチ計時し、text/span構築と結果コピーを含み、検索・索引構築は除外する。text・座標・level・spanの一致は計時外で確認する。標本は説明結果群当たりのバッチ平均で、個別クエリではない。ヒットしないpatternは空ループを測らず失敗させる。

`pairedInterval(runs, seed, q)`は`q=0.95`等のrun内分位点にも対応する。推定値はpaired runの分位点比の幾何平均で、run全体を対応づけて再標本化する。各打鍵を独立とするbootstrapや、全標本を混ぜた分位点の信頼区間ではない。求めるtailに十分な標本を**各run内**で用意し、時計の限界を守り、別の計測組で確認する。

合成スケーリングには`node tools/bench/corpus.mjs UNITS UINT32_SEED DOCS_JSONL WORKLOAD_JSON`を使える。3,000 BMP記号・指数1.05・10〜60単位のtextからなる決定的Zipfコーパスとseed固定の編集系列を生成する。UNITSは10,000〜10,000,000、出力先は未作成ファイルを指定する。準備済みCLIの`build DOCS_JSONL NEW_INDEX_ASIX`で別途ASIXを作り、比較runnerへASIXとworkloadを渡す。検索の計時区間でコーパス生成やCLI実行を行わない。アルゴリズム負荷の試験であり、関連度のベンチマークではない。ASIXのhashと生成器・seed・toolchainの識別情報を保持する。

paired intervalは0ms観測もrun内の整列対象に残す。比率を求めるには、**両側のすべてのrunで、選択した分位点**が正である必要があり、そうでなければ時計分解能以下として失敗する。分位点が正でも量子化の不確かさは残る。従来の固定level用`quantile` helperは、正の時間になるよう較正したバッチ標本を引き続き要求する。

`narrow-batch`は両側とも`auto`が必須です。blockedの強制や未知のengineは索引構築前に拒否し、sessionへ`engine: "auto"`を明示して、両側へ適用したengineを記録します。全量検索の強制比較には`kind: "search"`を使ってください。
