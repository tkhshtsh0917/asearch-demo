/** Verifies real server analysis through the released CLI and read-only WASM. */
import assert from "node:assert/strict";
import test from "node:test";
import { AsearchIndex, IntentIndex } from "asearch-wasm";
import { intents, search, searchOptions } from "../../src/worker/search.ts";
import { buildSegments } from "../site/segments.ts";
import { createAnalysis } from "./run.ts";

test("readings and directed synonyms survive ASIX v1, deltas and compaction", async () => {
  const rows = [
    { key: 0, text: "ビートルズの曲は？", title: "", url: "" },
    { key: 1, text: "Beatlesの結成はいつ？", title: "", url: "" },
    { key: 2, text: "🌟ビートルズの歌を聞く？", title: "", url: "" },
    { key: 3, text: "曲を聞かない理由は？", title: "", url: "" },
  ];
  const analysis = createAnalysis();
  const docs = analysis.analyze(rows);
  const first = rows[0];
  assert.ok(first);
  const changed = analysis.analyze([{ ...first, text: "別の質問です" }]);
  const segments = await buildSegments(
    docs,
    changed,
    [0],
    [...changed, ...docs.slice(1)],
  );
  const root = AsearchIndex.fromBytes(segments.base);
  const compact = AsearchIndex.fromBytes(segments.compact);
  const session = root.session(searchOptions);
  const intent = IntentIndex.fromEntries(intents, {
    profile: "ideal",
    normalizer: "ja-basic-v1",
  });
  const variants = [
    "ビートルズ",
    "びーとるず",
    "Beatles",
    "BEATLES",
    "beatles",
    "biitoruzu",
    "bi-toruzu",
  ];
  try {
    for (const query of variants) {
      assert.deepEqual([...root.search(query).ids], [0, 1, 2], query);
    }
    const message = search(
      1,
      "Beatles",
      "corpus",
      0,
      root,
      session,
      intent,
      new Map(rows.map((row) => [row.key, row])),
    );
    assert.equal(message.kind, "results");
    if (message.kind !== "results") throw new Error("Missing results");
    const original = message.rows.find((row) => row.key === 0);
    assert.equal(original?.text, rows[0]?.text);
    assert.deepEqual(original?.spans, []);
    assert.ok(original?.alias?.text.includes("Beatles"));

    await root.addSegment(segments.delta);
    for (const query of variants) {
      assert.deepEqual([...root.search(query).ids], [1, 2], query);
      assert.deepEqual([...compact.search(query).ids], [1, 2], query);
    }
  } finally {
    session.free();
    intent.free();
    root.free();
    compact.free();
  }
});
