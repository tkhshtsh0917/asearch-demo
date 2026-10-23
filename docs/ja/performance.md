# デモの計測

[English](../performance.md)

コア/APIの比較手順は[integrationの性能ガイド](../../integration/docs/ja/performance.md)にあります。デモではWorkerメッセージと採用されたDOM更新も計測します。

```sh
BASE_PATH=/asearch-demo/ mise exec -- pnpm build
mise exec -- pnpm preview --base /asearch-demo/ --port 4185 --strictPort
# ビルドとpreviewの起動が終わった後、別のターミナルで実行:
mise exec -- node tools/bench/ui.ts http://127.0.0.1:4185/asearch-demo/ OUTPUT_JSON
```

ビルド前にREADMEの手順で固定Release Assetsとコーパスを準備してください。runnerはloopback URLを受理し、Chromium・Firefox・WebKitを順番に実行し、試験ページだけへobserverを注入します。製品へのテレメトリー追加はありません。このrepoで実行し、指定URLからその`dist/`を配信し、ビルドを測定中に変更しないでください。レポートはローカルのビルド成果物とハーネスをhash化します。公開前のローカルbundleを測る場合はsource・raw asset hash・一時lockfileを別途保持し、開発用pinを公開Releaseとして扱わないでください。

各ブラウザは新しいcontextを使います。ready観測はnavigation・Worker起動・ローカルHTTP取得・検証・索引準備を含みますが、単独の診断標本で、OS cacheがcoldだったという主張はしません。8入力×28roundを再生し、最初の3roundをwarmupとして除外します。残る200標本にはWorkerが返す検索・説明時間、主スレッドでの要求→応答時間、要求→採用DOM mutation時間を保持します。DOM変更はアプリのanimation-frame callback内で起こりますが、**paint完了ではありません**。往復には直列化・スケジューリング・Worker実行を含みます。時計が異なるためWorker elapsedは参考の内訳であり、主スレッド時間から厳密に差し引けません。

各入力で対応するDOM mutationを待ち、標本数・非負で有限な時刻・エラーメッセージ・応答後のDOM反映順を確認します。これは逐次応答のベンチマークです。連続入力のキャンセル、遅延更新、アクセシビリティ、モバイルemulationは`pnpm test:e2e`で検証します。時間の閾値をCIのassertionにしません。observerには追加費用があり、network shapingも行わず、desktop計測はスマホ性能の保証になりません。このUI runnerはネットワーク取得・WASM compile・instantiateを個別には分解しません。別途観測できるメモリ上の構築費用はAPIのload比較を使ってください。
