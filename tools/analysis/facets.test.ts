/** Checks complete-before-filter ranking, exact facet counts and bounded article browsing. */
import assert from "node:assert/strict";
import test from "node:test";
import { articleFacets, articleOptions } from "../../src/shared/facets.ts";
import { fixture, result, run } from "./testing/search.ts";

test("article facets count questions, bound options and preserve removed selections", () => {
  const questions = new Map(
    Array.from({ length: 100 }, (_, key) => [
      key,
      { key, text: "質問", title: `記事${key}`, url: "" },
    ]),
  );
  questions.set(100, { key: 100, text: "別の質問", title: "記事0", url: "" });
  const facets = articleFacets(questions);
  assert.deepEqual(facets[0], { title: "記事0", count: 2 });
  assert.equal(articleOptions(facets, "記事", undefined).options.length, 50);
  assert.equal(
    articleOptions(facets, "不存在", "削除済み").options[0]?.count,
    0,
  );
  assert.equal(
    articleOptions(facets, "記事99", undefined).options[0]?.title,
    "記事99",
  );
  assert.equal(
    articleOptions([{ title: "ＡＢＣ", count: 1 }], "abc", undefined).matches,
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
  context.root.search = (_pattern, options) => {
    assert.equal(options?.limit, 30);
    return result(hits);
  };
  assert.ok(!run(context, "大学").rows.some((row) => row.key === 29));
  const filtered = run(context, "大学", "対象の記事");
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
  const filtered = run(context, "にh", "日本");
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
    () => run(context, "大学", "その他"),
    /Incomplete article search results/,
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
  const response = run(context, "", "記事");
  assert.equal(response.total, 30);
  assert.equal(response.rows.length, 20);
  assert.deepEqual(
    response.rows.map((row) => row.key),
    Array.from({ length: 20 }, (_, i) => i),
  );
  assert.equal(response.rows[0]?.snippet, "元の本文");
  assert.deepEqual(calls, ["reset"]);
  assert.equal(run(context, "", "削除済み").total, 0);
  assert.throws(
    () => run(context, "大学", "x".repeat(65536)),
    /Invalid article filter/,
  );
});
