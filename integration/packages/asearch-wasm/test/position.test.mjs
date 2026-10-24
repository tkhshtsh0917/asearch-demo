import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import * as esm from "../../../tests/fixtures/api.mjs";
import { withFixtures } from "../../../tests/fixtures/api.mjs";

const cjs = withFixtures(createRequire(import.meta.url)("../dist/node.cjs"));

for (const [name, api] of [
  ["ESM", esm],
  ["CJS", cjs],
]) {
  test(`${name}: positional ranking covers every alias before top-N and survives sessions and updates`, async () => {
    const docs = ["possibility", "xxbi", "xbi", "bi", "bx"].map(
      (text, key) => ({ key, texts: [text] }),
    );
    docs.push({ key: 5, texts: ["yyybi", "bi alias"] });
    const index = api.AsearchIndex.fromDocs(docs, {
      limits: { maxPatternUnits: 128 },
    });
    const options = {
      ranking: "position",
      maxAmbig: 1,
      countTotal: true,
      limit: 20,
    };
    const session = index.session(options);
    try {
      const hits = index.search("bi", options);
      assert.deepEqual([...hits.ids], [3, 5, 2, 1, 0, 4]);
      assert.deepEqual([...hits.starts], [0, 0, 1, 2, 5, 0]);
      assert.deepEqual([...hits.levels], [0, 0, 0, 0, 0, 1]);
      assert.deepEqual(
        [...index.search("bi", { ...options, limit: 2 }).ids],
        [3, 5],
      );
      assert.equal(index.search("bi").starts, undefined);
      const copy = hits.copy();
      hits.starts[0] = 99;
      assert.equal(copy.starts[0], 0);
      for (const query of ["b", "bi", "bix", "bi"]) {
        const full = index.search(query, options),
          cached = session.update(query);
        assert.deepEqual([...cached.ids], [...full.ids]);
        assert.deepEqual([...cached.starts], [...full.starts]);
      }
      const explained = index.explain(copy.refs[1], "bi", options);
      assert.ok(explained?.text.includes("bi"));
      await index.addSegment(
        api.buildDelta([{ key: 6, texts: ["bi new"] }], [3]),
      );
      assert.deepEqual([...session.update("bi").ids], [5, 6, 2, 1, 0, 4]);
    } finally {
      session.free();
      index.free();
    }
  });

  test(`${name}: positional shard merges require complete starts and one ranking mode`, () => {
    const a = api.AsearchIndex.fromDocs([{ key: 1, texts: ["xxbi"] }]);
    const b = api.AsearchIndex.fromDocs([{ key: 2, texts: ["bi"] }]);
    try {
      const first = a.search("bi", { ranking: "position" }),
        second = b.search("bi", { ranking: "position" });
      const merged = api.mergeResults([first, second], 2);
      assert.deepEqual([...merged.ids], [2, 1]);
      assert.deepEqual([...merged.starts], [0, 2]);
      assert.throws(
        () => api.mergeResults([first, b.search("bi")], 2),
        /ranking/,
      );
      assert.throws(() =>
        api.mergeResults([{ ...first, starts: new Uint32Array(0) }], 2),
      );
      assert.throws(() => a.search("bi", { ranking: "unknown" }));
    } finally {
      a.free();
      b.free();
    }
  });
}
