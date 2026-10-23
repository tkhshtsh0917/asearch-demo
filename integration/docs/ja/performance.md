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
