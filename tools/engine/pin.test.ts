import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { prepareArchive } from "./archive.ts";
import { enginePin } from "./pin.ts";

test("engine pins bind source revision and archive content without local checkout paths", async (t) => {
  const temporary = await mkdtemp(join(tmpdir(), "asearch-engine-pin-test-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const data = Buffer.from("test archive"),
    source = join(temporary, "input.tgz");
  const pin = enginePin({
    repository: "https://github.com/example/engine.git",
    revision: "a".repeat(40),
    package: "asearch-wasm",
    version: "0.1.0",
    archive: "asearch-wasm-0.1.0.tgz",
    sha256: createHash("sha256").update(data).digest("hex"),
  });
  await writeFile(source, data);
  const root = pathToFileURL(`${temporary}/`);
  await prepareArchive(source, pin, root);
  assert.deepEqual(
    await readFile(new URL(`vendor/${pin.archive}`, root)),
    data,
  );
  await writeFile(source, "corrupted");
  await assert.rejects(prepareArchive(source, pin, root), /SHA-256/);
  assert.throws(() => enginePin({ ...pin, archive: "../private.tgz" }));
  assert.throws(() => enginePin({ ...pin, revision: "main" }));
  assert.throws(() =>
    enginePin({
      ...pin,
      repository: "https://user:token@github.com/example/engine.git",
    }),
  );
});
