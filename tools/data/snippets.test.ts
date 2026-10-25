/** Covers Unicode bounds, source preservation and exact excerpt/question joins. */
import assert from "node:assert/strict";
import test from "node:test";
import { MAX_SNIPPET_CODE_POINTS } from "../../src/shared/snippets.ts";
import { serializeDocs } from "./corpus.ts";
import {
  attachSnippets,
  excerpt,
  serializeSnippets,
  snippetsFromRows,
} from "./snippets.ts";

test("excerpts collapse whitespace, preserve literal markup and respect Unicode bounds", () => {
  assert.equal(excerpt("  元の\n本文\tです。  "), "元の 本文 です。");
  assert.equal(
    excerpt("<img src=x onerror=alert(1)>"),
    "<img src=x onerror=alert(1)>",
  );
  assert.equal(excerpt("😀".repeat(160)), "😀".repeat(160));
  const text = excerpt("😀".repeat(161));
  assert.equal(Array.from(text).length, MAX_SNIPPET_CODE_POINTS);
  assert.equal(text, `${"😀".repeat(159)}…`);
  assert.equal(excerpt(" \n "), "");
  for (const value of [undefined, null, 3, "x".repeat(1024 * 1024 + 1)])
    assert.throws(() => excerpt(value), /Invalid source passage/);
});

test("excerpts join by exact keys and never become searchable texts", () => {
  const questions = [
    { key: 3, text: "質問？", title: "記事", url: "", passageId: 8 },
  ];
  const snippets = snippetsFromRows([{ text: "本文の抜粋" }], questions);
  const joined = attachSnippets(questions, snippets);
  assert.equal(joined[0]?.snippet, "本文の抜粋");
  assert.equal(joined[0]?.text, "質問？");
  assert.equal(serializeDocs(joined), serializeDocs(questions));
  assert.equal(
    serializeSnippets(snippets),
    '{"key":3,"snippet":"本文の抜粋"}\n',
  );
  for (const bad of [
    [],
    [{ key: 4, snippet: "誤った本文" }],
    [{ key: 3, snippet: "x".repeat(161) }],
    [{ key: 3, snippet: 42 }],
  ])
    assert.throws(() => attachSnippets(questions, bad));
  assert.throws(() =>
    attachSnippets(
      [...questions, { key: 4, text: "次の質問", title: "記事", url: "" }],
      [snippets[0], snippets[0]],
    ),
  );
  assert.throws(() => snippetsFromRows([], questions));
});
