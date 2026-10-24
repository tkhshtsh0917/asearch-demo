/** Verifies real server analysis through the released CLI and read-only WASM. */
import assert from "node:assert/strict";
import test from "node:test";
import { AsearchIndex, IntentIndex } from "asearch-wasm";
import { intents } from "../../src/shared/intents.ts";
import { QueryPolicy } from "../../src/shared/query.ts";
import { searchOptions } from "../../src/worker/options.ts";
import { search } from "../../src/worker/search.ts";
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
      { kind: "query", id: 1, pattern: "Beatles", mode: "corpus" },
      0,
      {
        root,
        session,
        intent,
        questions: new Map(rows.map((row) => [row.key, row])),
      },
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

test("native query forms make past and dictionary verbs share candidates without erasing negatives", async () => {
  const analysis = createAnalysis();
  const rows = [
    { key: 0, text: "寿司を食べた人は？", title: "", url: "" },
    { key: 1, text: "何を食べる？", title: "", url: "" },
    { key: 2, text: "寿司を食べない理由は？", title: "", url: "" },
  ];
  const policy = new QueryPolicy(analysis.queryRules(rows));
  assert.equal(policy.normalize("食べた"), "食べる");
  assert.equal(policy.normalize("食べました"), "食べる");
  assert.equal(policy.normalize("食べない"), "食べない");
  const parts = await buildSegments(
    analysis.analyze(rows),
    [],
    [],
    analysis.analyze(rows),
  );
  const root = AsearchIndex.fromBytes(parts.base);
  try {
    assert.deepEqual(
      [...root.search(policy.normalize("食べた")).ids],
      [...root.search(policy.normalize("食べる")).ids],
    );
    assert.equal(policy.fallback("びーt"), "bi-t");
  } finally {
    root.free();
  }
});

test("mixed input retries only on zero literal results and explains the effective query", async () => {
  const analysis = createAnalysis();
  const rows = [
    { key: 0, text: "ビートルズの曲は？", title: "", url: "" },
    { key: 1, text: "びーtという入力例です", title: "", url: "" },
  ];
  const policy = new QueryPolicy(analysis.queryRules(rows));
  const docs = analysis.analyze(rows);
  const parts = await buildSegments(docs, [], [], docs);
  const first = await buildSegments(docs.slice(0, 1), [], [], docs.slice(0, 1));
  const intent = IntentIndex.fromEntries(intents);
  for (const [bytes, expected] of [
    [parts.base, 1],
    [first.base, 0],
  ] as const) {
    const root = AsearchIndex.fromBytes(bytes),
      session = root.session(searchOptions);
    try {
      const response = search(
        { kind: "query", id: 1, pattern: "びーt", mode: "corpus" },
        0,
        {
          root,
          session,
          intent,
          questions: new Map(rows.map((row) => [row.key, row])),
          policy,
        },
      );
      assert.equal(response.kind, "results");
      if (response.kind !== "results") throw new Error("Missing results");
      assert.deepEqual(
        response.rows.map((row) => row.key),
        [expected],
      );
      if (expected === 0)
        assert.ok(response.rows[0]?.alias?.text.includes("bi-toruzu"));
    } finally {
      session.free();
      root.free();
    }
  }
  intent.free();
});
