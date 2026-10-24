import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { artifacts, unchanged, verifyServed } from "./provenance.ts";

async function fixture(t: import("node:test").TestContext) {
  const directory = await mkdtemp(join(tmpdir(), "asearch-bench-inputs-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const root = pathToFileURL(`${directory}/`);
  await mkdir(new URL("assets/", root));
  await mkdir(new URL("data/", root));
  const files = {
    "index.html": "<html>benchmark</html>",
    "assets/app.js": "code",
    "data/base.asix": "index",
    "data/query-rules.json": "rules",
  };
  for (const [name, body] of Object.entries(files))
    await writeFile(new URL(name, root), body);
  return { root, files };
}

test("publication data changes invalidate a benchmark even when JS and WASM are unchanged", async (t) => {
  const { root } = await fixture(t),
    before = await artifacts(root);
  assert.ok(before["data/query-rules.json"]);
  unchanged(before, await artifacts(root));
  await writeFile(new URL("data/query-rules.json", root), "other rules");
  assert.throws(() => unchanged(before, {}), /changed/);
  const after = await artifacts(root);
  assert.throws(() => unchanged(before, after), /changed/);
});

test("served-byte verification rejects the wrong build and bounds excess HTTP bodies", async (t) => {
  const { root, files } = await fixture(t),
    expected = await artifacts(root);
  const served = async (url: URL) =>
    new Response(files[url.pathname.slice(1) as keyof typeof files]);
  await verifyServed(new URL("http://localhost/"), expected, served);
  await assert.rejects(
    verifyServed(
      new URL("http://localhost/"),
      expected,
      async () => new Response("nope"),
    ),
    /differs/,
  );
  await assert.rejects(
    verifyServed(
      new URL("http://localhost/"),
      expected,
      async () => new Response("too much data"),
    ),
    /limit/,
  );
  await assert.rejects(
    verifyServed(
      new URL("http://localhost/"),
      expected,
      async () => new Response("missing", { status: 404 }),
    ),
    /unavailable|HTTP|failed/i,
  );
});
