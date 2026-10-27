import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { addressVectors } from "./address.ts";

test("immutable vector URLs preserve every non-URL identity and retain exact file bytes", async () => {
  const root = await mkdtemp(join(tmpdir(), "vector-address-"));
  try {
    for (const name of ["base.vecx", "delta.vecx", "compact.vecx"])
      await writeFile(join(root, name), name);
    const original = {
      schema: 1,
      space: "a",
      revision: "b",
      generation: "1",
      artifacts: [
        { url: "base.vecx", sha256: "c", parent: null },
        { url: "delta.vecx", sha256: "d", parent: "e" },
      ],
    };
    await writeFile(join(root, "before.json"), JSON.stringify(original));
    const [name] = await addressVectors(root, ["before.json"]);
    assert.ok(name);
    const bytes = await readFile(join(root, name)),
      manifest = JSON.parse(bytes.toString());
    assert.equal(
      name,
      `manifest.${createHash("sha256").update(bytes).digest("hex").slice(0, 20)}.json`,
    );
    for (const [i, artifact] of manifest.artifacts.entries()) {
      const previous = original.artifacts[i];
      assert.ok(previous);
      assert.equal(
        (await readFile(join(root, artifact.url))).toString(),
        previous.url,
      );
      artifact.url = previous.url;
    }
    assert.deepEqual(manifest, original);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
