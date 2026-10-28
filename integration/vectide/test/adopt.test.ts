import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { adoptDirectories } from "../tools/adopt.ts";

test("failed build-directory installation restores every previous output", async () => {
  const root = await mkdtemp(join(tmpdir(), "vector-adopt-"));
  try {
    for (const name of ["stage", "a", "b", "next"])
      await mkdir(join(root, name));
    await writeFile(join(root, "a", "marker"), "old-a");
    await writeFile(join(root, "b", "marker"), "old-b");
    await writeFile(join(root, "next", "marker"), "new");
    await assert.rejects(
      adoptDirectories(join(root, "stage"), [
        { source: join(root, "next"), target: join(root, "a") },
        { source: join(root, "missing"), target: join(root, "b") },
      ]),
    );
    assert.equal(await readFile(join(root, "a", "marker"), "utf8"), "old-a");
    assert.equal(await readFile(join(root, "b", "marker"), "utf8"), "old-b");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
