/** Verifies real server analysis through the released CLI and read-only WASM. */
import assert from "node:assert/strict";
import test from "node:test";
import { AsearchIndex } from "asearch-wasm";
import { QueryPolicy } from "../../src/shared/query.ts";
import { corpusOptions, searchOptions } from "../../src/worker/options.ts";
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
    const message = search({ kind: "query", id: 1, pattern: "Beatles" }, 0, {
      root,
      session,
      questions: new Map(rows.map((row) => [row.key, row])),
    });
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
    assert.equal(policy.romanize("びーt"), "bi-t");
  } finally {
    root.free();
  }
});

test("mixed input merges literal hits with romanized matches and keeps the winning explanation", async () => {
  const analysis = createAnalysis();
  const rows = [
    { key: 0, text: "ビートルズの曲は？", title: "", url: "" },
    { key: 1, text: "びーtという入力例です", title: "", url: "" },
  ];
  const policy = new QueryPolicy(analysis.queryRules(rows));
  const docs = analysis.analyze(rows);
  const parts = await buildSegments(docs, [], [], docs);
  const first = await buildSegments(docs.slice(0, 1), [], [], docs.slice(0, 1));
  try {
    for (const [bytes, expected] of [
      [parts.base, [0, 1]],
      [first.base, [0]],
    ] as const) {
      const root = AsearchIndex.fromBytes(bytes),
        session = root.session(corpusOptions);
      try {
        const response = search({ kind: "query", id: 1, pattern: "びーt" }, 0, {
          root,
          session,
          questions: new Map(rows.map((row) => [row.key, row])),
          policy,
        });
        if (response.kind !== "results") throw new Error("Missing results");
        assert.deepEqual(
          response.rows.map((row) => row.key),
          expected,
        );
        assert.ok(
          response.rows
            .find((row) => row.key === 0)
            ?.alias?.text.includes("bi-toruzu"),
        );
        assert.equal(response.total, expected.length);
        assert.equal(response.totalIsExact, true);
      } finally {
        session.free();
        root.free();
      }
    }
  } finally {
  }
});

test("a literal H-II match cannot suppress Japan through deltas and compaction", async () => {
  const analysis = createAnalysis();
  const rows = [
    { key: 0, text: "日本語の歴史は？", title: "日本語", url: "" },
    {
      key: 1,
      text: "1999年(平成11年)11月にH-IIロケット8号機で打上げたが、第1段エンジンに故障が発生したため、地上からの指令によりロケットは破壊され、その残骸と、ペイロードであった本機も海中に没したのは何？",
      title: "ロケット",
      url: "",
    },
  ];
  const added = { key: 2, text: "日本人の現在は？", title: "日本人", url: "" };
  const policy = new QueryPolicy(analysis.queryRules([...rows, added]));
  const docs = analysis.analyze(rows),
    upserts = analysis.analyze([added]);
  const parts = await buildSegments(
    docs,
    upserts,
    [0],
    [...docs.slice(1), ...upserts],
  );
  const root = AsearchIndex.fromBytes(parts.base),
    session = root.session(corpusOptions);
  const context = {
    root,
    session,
    questions: new Map(rows.map((row) => [row.key, row])),
    policy,
  };
  const keys = () => {
    const response = search(
      { kind: "query", id: 1, pattern: "にh" },
      0,
      context,
    );
    if (response.kind !== "results") throw new Error("Missing results");
    return response.rows.map((row) => row.key);
  };
  try {
    assert.ok([...root.search("にh", corpusOptions).ids].includes(1));
    assert.equal(policy.romanize("にh"), "nih");
    assert.deepEqual(keys(), [0, 1]);
    await root.addSegment(parts.delta);
    context.questions.delete(0);
    context.questions.set(2, added);
    assert.deepEqual(keys(), [2, 1]);
    await root.replaceSegments([{ source: parts.compact }]);
    assert.deepEqual(keys(), [2, 1]);
  } finally {
    session.free();
    root.free();
  }
});

test("native article filtering retrieves matching IDs beyond the global display limit", async () => {
  const analysis = createAnalysis();
  const rows = Array.from({ length: 30 }, (_, key) => ({
    key,
    text: `大学の質問${key}`,
    title: key === 29 ? "対象の記事" : "その他",
    url: "",
  }));
  const docs = analysis.analyze(rows);
  const parts = await buildSegments(docs, [], [], docs);
  const root = AsearchIndex.fromBytes(parts.base),
    session = root.session(corpusOptions);
  const context = {
    root,
    session,
    questions: new Map(rows.map((row) => [row.key, row])),
  };
  try {
    const request = {
      kind: "query",
      id: 1,
      pattern: "大学",
    } as const;
    const global = search(request, 0, context);
    if (global.kind !== "results") throw new Error("Missing results");
    assert.equal(global.rows.length, 20);
    assert.ok(!global.rows.some((row) => row.key === 29));
    const filtered = search({ ...request, title: "対象の記事" }, 0, context);
    if (filtered.kind !== "results") throw new Error("Missing results");
    assert.deepEqual(
      filtered.rows.map((row) => row.key),
      [29],
    );
    assert.equal(filtered.total, 1);
    assert.equal(filtered.totalIsExact, true);
  } finally {
    session.free();
    root.free();
  }
});
