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

## ロードと短時間操作の比較

同じrunnerで`kind: "load"`を指定すると、expectedのSHA-384検査を含むメモリ上の`fromBytes`を計時する。指定ASIXからdescriptorを作り、検索結果の照合と解放は計時外で行う。検証と派生構造構築の費用を測り、モジュール初期化・HTTP通信・描画は含めない。指定例：

```json
{ "kind": "load", "runs": 5, "rounds": 10, "warmup": 3 }
```

ブラウザの時計分解能より短い操作には`kind: "narrow-batch"`を使う。計時外でresetとprimeを行った後、公開session.updateを反復する。`primer`・`pattern`・`iterations`（既定512）を指定する。primeと最後の結果は版間で一致し、narrowing経路を選択する必要がある。コーパスやKポリシーの変化が不適切なら測定を失敗させる。これはwarm状態での同一クエリ反復であり、打鍵系列ではない。標本は**update当たりのバッチ平均ms**と表記し、個別打鍵の分位点と呼ばない。

どの操作でも0ms標本、rawのpaired runs、AB/BA順を保持する。load/batchの要約では100標本未満のp95、1,000標本未満のp99を省略する。`statistics.mjs`の`pairedInterval`でrun全体を再標本化し、中央値が正の場合だけ比率を求める。独立processで再確認し、少数バッチからtailの確実性を推論しない。成果物hashは計測bytesを識別するが、source commitラベルだけでは来歴の証明にならない。

session・segmentの要約でも100標本未満のp95、1,000標本未満のp99を省略する。この最小件数だけでtailの精度を保証せず、run間変動と時計の0ms標本を確認する。
