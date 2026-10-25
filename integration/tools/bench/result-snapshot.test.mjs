import assert from "node:assert/strict";
import test from "node:test";
import { resultSnapshot } from "./result-snapshot.mjs";
import { searchSettings } from "./search-settings.mjs";

test("rank equivalence includes positional starts but excludes owner-local references", () => {
  const base = {
    ids: [1],
    levels: [0],
    orders: [0],
    totals: [1],
    starts: [0],
    refs: [100],
  };
  assert.equal(
    resultSnapshot(base, true),
    resultSnapshot({ ...base, refs: [900] }, true),
  );
  assert.notEqual(
    resultSnapshot(base, true),
    resultSnapshot({ ...base, starts: [1] }, true),
  );
  assert.throws(
    () => resultSnapshot({ ...base, starts: undefined }, true),
    /missing starts/,
  );
  assert.doesNotThrow(() => resultSnapshot({ ...base, starts: undefined }));
});

test("benchmark settings reject unsupported ranking and output limits", () => {
  for (const ranking of ["unknown", null, 1])
    assert.throws(() => searchSettings("auto", 20, ranking), RangeError);
  for (const limit of [-1, 1.5, NaN, 0x100000000])
    assert.throws(() => searchSettings("auto", limit), RangeError);
});
