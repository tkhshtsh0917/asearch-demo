/** Checks display-only excerpt bounds before metadata reaches the UI. */
import assert from "node:assert/strict";
import test from "node:test";
import { catalog } from "../../src/shared/catalog.ts";

test("catalog accepts bounded Unicode excerpts and rejects malformed or oversized values", () => {
  const row = { key: 1, text: "質問", title: "記事", url: "" };
  assert.equal(catalog([row])[0]?.snippet, undefined);
  assert.equal(
    catalog([{ ...row, snippet: "😀".repeat(160) }])[0]?.snippet,
    "😀".repeat(160),
  );
  for (const snippet of [42, null, {}, "x".repeat(161), "😀".repeat(161)])
    assert.throws(
      () => catalog([{ ...row, snippet }]),
      /Invalid catalog entry/,
    );
});
