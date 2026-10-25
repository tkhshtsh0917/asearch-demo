/** Proves that transport checks detect modifications, omissions and unexpected content. */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { siteHashes, verifySite } from "./artifact.ts";

test("a complete site passes and modified, missing or extra files fail", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "asearch-pages-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, "assets"));
  await writeFile(join(directory, "index.html"), "site");
  await writeFile(
    join(directory, "assets/engine.wasm"),
    new Uint8Array([0, 97, 115, 109]),
  );
  const expected = await siteHashes(directory);
  await verifySite(directory, JSON.parse(JSON.stringify(expected)));

  await writeFile(join(directory, "index.html"), "changed");
  await assert.rejects(verifySite(directory, expected), /content mismatch/);
  await writeFile(join(directory, "index.html"), "site");
  await writeFile(join(directory, "unexpected.txt"), "extra");
  await assert.rejects(verifySite(directory, expected), /content mismatch/);
  await rm(join(directory, "unexpected.txt"));
  await rm(join(directory, "assets/engine.wasm"));
  await assert.rejects(verifySite(directory, expected), /content mismatch/);
  for (const value of [null, [], {}, { "index.html": "invalid" }])
    await assert.rejects(
      verifySite(directory, value),
      /Invalid site hash manifest/,
    );
});

test("hidden files and links cannot silently differ from the Pages archive", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "asearch-pages-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, ".hidden"), "private");
  await assert.rejects(siteHashes(directory), /Hidden site files/);
  await rm(join(directory, ".hidden"));
  await writeFile(join(directory, "real.txt"), "site");
  await symlink("real.txt", join(directory, "link.txt"));
  await assert.rejects(siteHashes(directory), /links or special files/);
});
