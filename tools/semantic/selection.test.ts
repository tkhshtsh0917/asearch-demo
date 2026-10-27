import assert from "node:assert/strict";
import test from "node:test";
import { semanticRelease } from "../../src/semantic/identity.ts";
import { eligibleIds } from "../../src/semantic/selection.ts";
import { semanticArticleOptions } from "../../src/shared/facets.ts";
import { cacheMatches, questionInput } from "./documents.ts";

const rows = [
  { key: 1, text: "a", title: "記事A", url: "" },
  { key: 2, text: "b", title: "記事B", url: "" },
  { key: 3, text: "c", title: "記事A", url: "" },
];
const changes = new Map([
  [2, "added" as const],
  [3, "updated" as const],
]);
test("semantic facets apply to the whole catalog before top-k, with OR within axes and AND between axes", () => {
  assert.equal(eligibleIds(rows, changes, undefined, []), undefined);
  assert.deepEqual(
    [
      ...(eligibleIds(
        rows,
        changes,
        { articles: ["記事A", "記事B"], changes: ["added", "updated"] },
        [2],
      ) ?? []),
    ],
    [3],
  );
  assert.deepEqual(
    [
      ...(eligibleIds(
        rows,
        changes,
        { articles: ["missing"], changes: [] },
        [],
      ) ?? []),
    ],
    [],
  );
  assert.deepEqual(
    [
      ...(eligibleIds(
        rows,
        new Map(),
        { articles: [], changes: ["unchanged"] },
        [],
      ) ?? []),
    ],
    [1, 2, 3],
  );
});
test("publication bindings reject missing stages, unsafe paths and malformed identities", () => {
  const stage = {
    catalog: "catalog.json",
    catalogSha256: "1".repeat(64),
    lexicalManifest: "lexical.json",
    vectorManifest: "vector.json",
    vectorManifestSha256: "2".repeat(64),
    space: "3".repeat(64),
  };
  const value = {
    schema: 1,
    encoderProfile: "4".repeat(64),
    encoderWorker: "worker-1.js",
    encoderDirectory: "encoder-test",
    bindingsDirectory: "bindings-test",
    stages: [stage, stage, stage],
  };
  assert.equal(semanticRelease(value).stages.length, 3);
  assert.throws(() => semanticRelease({ ...value, stages: [stage] }));
  assert.throws(() =>
    semanticRelease({ ...value, encoderWorker: "../worker.js" }),
  );
  assert.throws(() => semanticRelease({ ...value, encoderProfile: "invalid" }));
});

test("document cache identity ignores display metadata and includes every locked encoder input", () => {
  const before = [{ key: 1, text: "質問", title: "old", url: "" }] as const,
    after = [{ ...before[0], title: "new", snippet: "display only" }];
  assert.equal(questionInput(before), questionInput(after));
  assert.notEqual(
    questionInput(before),
    questionInput([{ ...before[0], text: "変更" }]),
  );
  const expected = {
    modelLockSha256: "a",
    pythonLockSha256: "b",
    scriptSha256: "c",
    rows: 1,
    dimensions: 256,
  };
  assert.equal(cacheMatches({ ...expected, extra: "kept" }, expected), true);
  for (const key of Object.keys(expected))
    assert.equal(
      cacheMatches({ ...expected, [key]: "changed" }, expected),
      false,
    );
});

test("catalog choices retain lexical counts and add unique zero-count articles", () => {
  assert.deepEqual(
    semanticArticleOptions([{ title: "A", count: 3 }], ["A", "B", "B"]),
    [
      { title: "A", count: 3 },
      { title: "B", count: 0 },
    ],
  );
});
