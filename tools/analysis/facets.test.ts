/** Checks complete-before-filter ranking, exact facet counts and bounded article browsing. */
import assert from "node:assert/strict";
import test from "node:test";
import { articleOptions, searchFilters } from "../../src/shared/facets.ts";
import { refine } from "../../src/worker/facets.ts";
import { fixture, result, run } from "./testing/search.ts";

test("article facets count questions, bound options and preserve removed selections", () => {
  const questions = new Map(
    Array.from({ length: 100 }, (_, key) => [
      key,
      { key, text: "質問", title: `記事${key}`, url: "" },
    ]),
  );
  questions.set(100, { key: 100, text: "別の質問", title: "記事0", url: "" });
  const facets = refine(questions.keys(), questions, undefined, {
    articles: [],
    changes: [],
  }).facets.articles;
  assert.deepEqual(facets[0], { title: "記事0", count: 2 });
  assert.equal(articleOptions(facets, "記事", []).options.length, 50);
  assert.equal(
    articleOptions(facets, "不存在", ["削除済み"]).options[0]?.count,
    0,
  );
  assert.equal(
    articleOptions(facets, "記事99", []).options[0]?.title,
    "記事99",
  );
  assert.equal(
    articleOptions([{ title: "ＡＢＣ", count: 1 }], "abc", []).matches,
    1,
  );
});

test("an article candidate beyond global top-20 is retrieved before filtering", () => {
  const hits = Array.from({ length: 30 }, (_, key) => ({ key, start: key }));
  const { context } = fixture(result(hits.slice(0, 20), 30));
  context.questions = new Map(
    hits.map(({ key }) => [
      key,
      {
        key,
        text: "大学の質問",
        title: key === 29 ? "対象の記事" : "その他",
        url: "",
      },
    ]),
  );
  context.session.update = () => result(hits);
  assert.ok(!run(context, "大学").rows.some((row) => row.key === 29));
  const filtered = run(context, "大学", {
    articles: ["対象の記事"],
    changes: [],
  });
  assert.deepEqual(
    filtered.rows.map((row) => row.key),
    [29],
  );
  assert.equal(filtered.total, 1);
  assert.equal(filtered.totalIsExact, true);
});

test("alternate-query duplicates use the winning rank before article filtering", () => {
  const primary = result([
    { key: 0, start: 0 },
    { key: 5, start: 8 },
  ]);
  const alternative = result([
    { key: 5, start: 0, ref: 202 },
    { key: 6, start: 2 },
  ]);
  const { context, explanations } = fixture(primary, alternative);
  context.questions = new Map(
    [0, 5, 6].map((key) => [
      key,
      { key, text: "質問", title: key ? "日本" : "その他", url: "" },
    ]),
  );
  context.root.search = (pattern) =>
    pattern === "にh" ? primary : alternative;
  const filtered = run(context, "にh", { articles: ["日本"], changes: [] });
  assert.deepEqual(
    filtered.rows.map((row) => row.key),
    [5, 6],
  );
  assert.equal(filtered.total, 2);
  assert.equal(filtered.totalIsExact, true);
  assert.deepEqual(explanations[0], [202, "nih"]);
});

test("article filtering rejects unexpectedly truncated native results", () => {
  const partial = result([{ key: 1, start: 0 }], 200);
  const { context } = fixture(partial);
  context.root.search = () => partial;
  assert.throws(
    () => run(context, "大学", { articles: ["その他"], changes: [] }),
    /Incomplete facet search results/,
  );
});

test("blank article queries browse at most 20 catalog records and preserve exact counts", () => {
  const { context, calls } = fixture(result([]));
  context.questions = new Map(
    Array.from({ length: 30 }, (_, i) => {
      const key = 29 - i;
      return [
        key,
        {
          key,
          text: `質問${key}`,
          title: "記事",
          url: "",
          snippet: "元の本文",
        },
      ];
    }),
  );
  context.root.search = () => {
    throw new Error("Unexpected matcher call");
  };
  const response = run(context, "", { articles: ["記事"], changes: [] });
  assert.equal(response.total, 30);
  assert.equal(response.rows.length, 20);
  assert.deepEqual(
    response.rows.map((row) => row.key),
    Array.from({ length: 20 }, (_, i) => i),
  );
  assert.equal(response.rows[0]?.snippet, "元の本文");
  assert.deepEqual(calls, ["reset"]);
  assert.equal(
    run(context, "", { articles: ["削除済み"], changes: [] }).total,
    0,
  );
  assert.throws(
    () => run(context, "大学", { articles: ["x".repeat(65536)], changes: [] }),
    /Invalid search filters/,
  );
});

test("article choices use OR, axes use AND and each facet excludes its own selection", () => {
  const { context } = fixture(
    result(Array.from({ length: 5 }, (_, key) => ({ key, start: key }))),
  );
  context.questions = new Map(
    ["A", "A", "B", "B", "C"].map((title, key) => [
      key,
      { key, title, text: "質問", url: "" },
    ]),
  );
  context.changes = new Map([
    [1, "updated"],
    [2, "added"],
    [3, "updated"],
  ]);
  const response = run(context, "日本", {
    articles: ["A", "B"],
    changes: ["updated"],
  });
  assert.deepEqual(
    response.rows.map((row) => row.key),
    [1, 3],
  );
  assert.equal(response.total, 2);
  assert.deepEqual(response.facets, {
    articles: [
      { title: "A", count: 1 },
      { title: "B", count: 1 },
    ],
    changes: [
      { kind: "unchanged", count: 1 },
      { kind: "added", count: 1 },
      { kind: "updated", count: 2 },
    ],
  });
  const union = run(context, "日本", {
    articles: ["B"],
    changes: ["added", "updated"],
  });
  assert.deepEqual(
    union.rows.map((row) => row.key),
    [2, 3],
  );
  assert.deepEqual(union.facets?.articles, [
    { title: "B", count: 2 },
    { title: "A", count: 1 },
  ]);
});

test("blank browsing preserves zero-count selections through restoration", () => {
  const { context } = fixture(result([{ key: 1, start: 0 }]));
  context.questions = new Map([
    [1, { key: 1, title: "記事", text: "質問", url: "" }],
  ]);
  context.changes = new Map([[1, "added"]]);
  const filters = { articles: ["記事"], changes: ["added"] } as const;
  assert.equal(run(context, "", filters).total, 1);
  context.changes = new Map();
  const restored = run(context, "", filters);
  assert.equal(restored.total, 0);
  assert.deepEqual(restored.facets?.changes, [
    { kind: "unchanged", count: 1 },
    { kind: "added", count: 0 },
    { kind: "updated", count: 0 },
  ]);
  assert.deepEqual(
    articleOptions(restored.facets?.articles ?? [], "", ["記事"]).options,
    [{ title: "記事", count: 0 }],
  );
});

test("facet selections reject duplicates, invalid kinds and oversized requests before matching", () => {
  for (const filters of [
    null,
    { articles: ["A", "A"], changes: [] },
    { articles: Array.from({ length: 51 }, (_, i) => String(i)), changes: [] },
    { articles: [], changes: ["added", "added"] },
    { articles: [], changes: ["deleted"] },
    { articles: ["x".repeat(65536)], changes: [] },
    { articles: [], changes: [], extra: true },
  ]) {
    const { context, calls } = fixture(result([]));
    assert.throws(
      () => run(context, "日本", filters as never),
      /Invalid search filters/,
    );
    assert.deepEqual(calls, []);
  }
});

test("complete keyword matches must all resolve to catalog records", () => {
  const { context } = fixture(result([{ key: 1, start: 0 }]));
  context.questions = new Map();
  assert.throws(() => run(context, "日本"), /Missing result question/);
});

test("fifty selections are accepted and retained alongside fifty unselected options", () => {
  const articles = Array.from({ length: 50 }, (_, i) => `記事${i}`);
  assert.deepEqual(searchFilters({ articles, changes: [] }).articles, articles);
  const facets = Array.from({ length: 100 }, (_, i) => ({
    title: `記事${i}`,
    count: 1,
  }));
  const options = articleOptions(facets, "", articles).options;
  assert.equal(options.length, 100);
  assert.deepEqual(
    options.slice(0, 50).map((option) => option.title),
    articles,
  );
});
