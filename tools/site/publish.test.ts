import assert from "node:assert/strict";
import test from "node:test";
import { AsearchIndex, diffManifest, type Manifest } from "asearch-wasm";
import { catalog, release, sourceUrl } from "../../src/shared/catalog.ts";
import { fixture } from "../analysis/testing/fixture.ts";
import { digest, publish } from "./publish.ts";

test("publisher emits coherent base, atomic delta and canonical compaction", async (t) => {
  const f = fixture(t);
  const analysis = await f.prepare();
  const provenance = analysis.provenance();
  const files = await publish(
    Array.from({ length: 4 }, (_, key) => ({
      key,
      text: `質問${key}`,
      title: "出典",
      url: "https://ja.wikipedia.org/wiki/Test",
    })),
    {
      creator: "Test",
      license: "CC-BY-SA-4.0",
      changes: "Extracted questions",
    },
    {
      analyze(rows) {
        const result = analysis.analyze(rows);
        f.policy(2);
        return result;
      },
      provenance: analysis.provenance,
      queryRules(rows) {
        assert.equal(new Set(rows.map((row) => row.key)).size, rows.length);
        assert.ok(rows.some((row) => row.text.startsWith("更新例：")));
        assert.ok(rows.some((row) => row.text === "質問0"));
        return analysis.queryRules(rows);
      },
    },
  );

  const json = (name: string) =>
    JSON.parse(new TextDecoder().decode(files.get(name)));

  const info = release(json("release.json"));
  assert.deepEqual(json("analysis.json"), provenance);
  const queryAsset = files.get(info.queryRules.url);
  assert.ok(queryAsset);
  assert.equal(digest(queryAsset), info.queryRules.sha256);
  assert.deepEqual(json(info.queryRules.url).forms, [["変化", "A/1"]]);
  const manifests = info.stages.map(
    (stage) => json(stage.manifest) as Manifest,
  );
  const a = manifests[0],
    b = manifests[1],
    c = manifests[2];
  assert.ok(a && b && c);
  assert.equal(diffManifest(a, b).kind, "append");
  assert.equal(diffManifest(b, c).kind, "replace");

  const segment = a.segments[0];
  assert.ok(segment);
  const bytes = files.get(segment.url);
  assert.ok(bytes);

  const root = AsearchIndex.fromBytes(bytes, { expected: segment });
  try {
    const delta = b.segments[1];
    assert.ok(delta);
    const data = files.get(delta.url);
    assert.ok(data);
    await root.addSegment(data, delta);

    const compact = c.segments[0];
    assert.ok(compact);
    const compactBytes = files.get(compact.url);
    assert.ok(compactBytes);
    const rebuilt = AsearchIndex.fromBytes(compactBytes, { expected: compact });
    try {
      assert.deepEqual(
        [...root.search("更新例").ids],
        [...rebuilt.search("更新例").ids],
      );
    } finally {
      rebuilt.free();
    }

    assert.equal(root.search("更新例", { countTotal: true }).length, 4);
    assert.equal(
      root.search("old/1/A/D", { countTotal: true, maxAmbig: 0 }).length,
      4,
    );
    assert.equal(
      root.search("old/2/A/D", { countTotal: true, maxAmbig: 0 }).length,
      0,
    );

    for (const stage of info.stages) {
      const data = files.get(stage.catalog);
      assert.ok(data);
      assert.equal(digest(data), stage.catalogSha256);
      assert.equal(catalog(json(stage.catalog)).length, 4);
    }
  } finally {
    root.free();
  }
});

test("catalog links reject unsafe origins and URL schemes", () => {
  assert.throws(() => sourceUrl("https://evil.test/wiki/X"));

  assert.throws(() =>
    catalog([{ key: 1, text: "x", title: "x", url: "javascript:alert(1)" }]),
  );
});
