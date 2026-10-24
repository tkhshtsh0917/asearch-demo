import assert from "node:assert/strict";
import test from "node:test";
import type { Question } from "../../src/shared/catalog.ts";
import { catalogChanges } from "../../src/shared/changes.ts";

const question = (key: number, text = "質問"): Question => ({
  key,
  text,
  title: "出典",
  url: "",
});
const map = (rows: Question[]) => new Map(rows.map((row) => [row.key, row]));

test("catalog change labels distinguish additions, updates and removals without marking unchanged questions", () => {
  const before = map([
    question(0),
    question(1),
    question(2),
    question(3),
    question(4),
  ]);
  const after = map([
    question(0),
    question(1, "変更"),
    { ...question(2), title: "別の出典" },
    { ...question(3), url: "https://ja.wikipedia.org/wiki/Test" },
    question(5, "追加"),
  ]);
  const result = catalogChanges(before, after);
  assert.deepEqual(result.summary, { added: 1, updated: 3, removed: 1 });
  assert.deepEqual(
    [...result.byKey],
    [
      [1, "updated"],
      [2, "updated"],
      [3, "updated"],
      [5, "added"],
    ],
  );
  assert.deepEqual(catalogChanges(before, before).summary, {
    added: 0,
    updated: 0,
    removed: 0,
  });
  assert.equal(catalogChanges(before, before).byKey.size, 0);
  assert.equal(before.get(1)?.text, "質問");
});
