# asearch-wasm

[English](README.md)

サーバー生成のASIX v1 segmentを扱う、読み取り専用WASM検索ランタイムです。デモがローカルで利用し、npmには公開しません。

Release版のnative CLIでサーバー側の索引を構築します。

```sh
asearch-cli build docs.jsonl base.asix
asearch-cli delta changes.jsonl delta.asix
asearch-cli compact compact.asix base.asix delta.asix
```

ブラウザまたはmodule Workerでロード・検索します。

```js
import { AsearchIndex, ready } from "asearch-wasm";
await ready;
const response = await fetch("/base.asix");
if (!response.ok || !response.body) throw new Error("Index unavailable");
const index = await AsearchIndex.fromStream(response.body);
try {
  console.log(index.search("検索", { countTotal: true }));
} finally {
  index.free();
}
```

dist全体をHTTP(S)で配信してください。ブラウザは非同期初期化で、失敗時readyはrejectしinit(input)で再試行できます。Node ESM・CommonJSは同期初期化し、同じ読み取り専用WASMを使います。

AsearchIndexはfromBytes・fromStream・search・session・explain・segments・addSegment・replaceSegments・freeを提供します。サーバー生成・シリアライズAPIはありません。結果はコピーした配列を所有し、opaque refは更新成功後に失効します。更新失敗では旧状態を保持します。sessionはコーパスを共有し、親の解放で無効になります。

独立した互換AsearchとIntentIndexのDAG APIも利用できます。profile・正規化・資源予算・stream検証・更新契約はintegration仕様で説明します。新規コードはMIT OR Apache-2.0で、WASMとともにLICENSE-MIT・LICENSE-APACHE・NOTICE・dist/licensesを配布します。

不変索引の`search(query, { ranking: "position" })`と同optionのsessionは、最小編集距離、最も早い正規化UTF-16開始位置、`order`、`key`の順に並べます。Rust・WASM 0.3以降が必要です。上位制限前に全生存一致別名を評価します。結果は任意の`starts`を持ち、記号未消費は`0xffffffff`です。`copy()`も保持し、`mergeResults`は全partで同じ順位modeを要求します。既定順序とIntentIndexの順位は変えません。[Rustの順位契約](https://github.com/tkhshtsh0917/asearch/blob/main/docs/ja/ranking.md)を参照してください。
