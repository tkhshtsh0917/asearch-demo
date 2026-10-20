import assert from "node:assert/strict";
import test from "node:test";
import {
  questionsFromRows,
  serializeDocs,
  serializeQuestions,
} from "./corpus.ts";

const source = {
  passage_id: 5n,
  query: "  ｶﾞの意味は？",
  title: "例",
  url: "https://ja.wikipedia.org/wiki/例",
};

test("physical row IDs distinguish questions from the same article and preserve query text", () => {
  const questions = questionsFromRows(
    [source, { ...source, query: "別の質問？" }],
    10,
  );
  assert.deepEqual(
    questions.map((q) => [q.key, q.passageId]),
    [
      [10, 5],
      [11, 5],
    ],
  );
  assert.equal(questions[0]?.text, source.query);
  const docs = serializeDocs(questions)
    .trimEnd()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.deepEqual(docs, [
    { key: 10, texts: [source.query] },
    { key: 11, texts: ["別の質問？"] },
  ]);
  assert.equal(
    serializeQuestions(questions),
    serializeQuestions(
      questionsFromRows([source, { ...source, query: "別の質問？" }], 10),
    ),
  );
  assert.equal(
    JSON.parse(serializeQuestions(questions).split("\n")[0] as string).text,
    source.query,
  );
});

test("invalid data fails rather than silently dropping rows or producing unsafe links", () => {
  for (const patch of [
    { query: "  " },
    { query: "a".repeat(65536) },
    { passage_id: 9007199254740993n },
    { passage_id: -1 },
    { url: "javascript:alert(1)" },
    { url: "https://ja.wikipedia.org.evil.test/wiki/x" },
    { url: "https://user:password@ja.wikipedia.org/wiki/x" },
    { url: "http://ja.wikipedia.org/wiki/x" },
  ])
    assert.throws(() => questionsFromRows([{ ...source, ...patch }], 0));
  for (const start of [-1, 1.5, Number.MAX_SAFE_INTEGER])
    assert.throws(() => questionsFromRows([source], start));
});
