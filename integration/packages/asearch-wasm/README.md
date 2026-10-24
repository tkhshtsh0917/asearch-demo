# asearch-wasm

[日本語](README.ja.md)

Read-only WebAssembly search runtime over server-generated ASIX v1 segments. This package is used locally by the demo and is not published to npm.

Build indexes on the server with the released native CLI:

```sh
asearch-cli build docs.jsonl base.asix
asearch-cli delta changes.jsonl delta.asix
asearch-cli compact compact.asix base.asix delta.asix
```

Load and search in the browser or a module Worker:

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

The complete dist directory must be served over HTTP(S). Browser initialization is asynchronous; ready rejects on failure and init(input) permits retry. Node ESM and CommonJS initialize synchronously. Both use the same read-only WASM.

AsearchIndex provides fromBytes/fromStream, search, session, explain, segments, addSegment/replaceSegments and free. Server generation and serialization APIs are absent. Results own their copied arrays; opaque references expire after successful updates. Failed updates preserve the previous state. Sessions share the corpus and are invalidated when their parent is freed.

The separate Asearch compatibility matcher and IntentIndex DAG API remain available. Profiles, normalization, resource budgets, stream validation and update contracts are described in the integration specifications. New code is MIT OR Apache-2.0; distribute LICENSE-MIT, LICENSE-APACHE, NOTICE and dist/licenses with the WASM.

For immutable indexes, `search(query, { ranking: "position" })` and sessions with the same option rank by minimum edit distance, then earliest normalized UTF-16 match start, then `order` and `key`. This requires Rust/WASM 0.3+. Ranking covers all live matching aliases before top-N. Results optionally include `starts` (`0xffffffff` for no consumed symbol); `copy()` retains them and `mergeResults` requires all parts to use the same ranking mode. The default stable order and IntentIndex ordering are unchanged. See the [Rust ranking contract](https://github.com/tkhshtsh0917/asearch/blob/main/docs/ranking.md).
