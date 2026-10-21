import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as api from "../dist/node.mjs";

test("runtime artifact and public API contain no server index writer", async () => {
  const bytes = await readFile(
    new URL("../dist/web/asearch_wasm_bg.wasm", import.meta.url),
  );
  const names = WebAssembly.Module.exports(new WebAssembly.Module(bytes)).map(
    (entry) => entry.name,
  );
  for (const name of [
    "indexhandle_build_delta_flat",
    "indexhandle_from_flat",
    "indexhandle_to_bytes",
  ])
    assert.ok(!names.includes(name), name);
  for (const name of ["buildIndex", "buildDelta"])
    assert.ok(!(name in api), name);
  for (const name of ["fromDocs", "fromStrings"])
    assert.ok(!(name in api.AsearchIndex), name);
  assert.ok(!("toBytes" in api.AsearchIndex.prototype));
});
