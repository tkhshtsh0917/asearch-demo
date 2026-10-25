import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { assertPatchedNode } from "./runtime.ts";

test("the runtime floor follows patched Node releases, not the bundled Brotli version label", () => {
  for (const version of ["22.23.4", "22.24.0", "24.22.1", "24.23.0"])
    assert.doesNotThrow(() => assertPatchedNode(version));
  for (const version of [
    "22.23.3",
    "22.22.99",
    "24.22.0",
    "24.21.99",
    "20.99.0",
    "25.0.0",
    "24.22.1-rc.1",
    "invalid",
  ])
    assert.throws(() => assertPatchedNode(version), /CVE-2026-111497/);
});

test("network entry points reject an old runtime before calling fetch", () => {
  for (const module of [
    "../engine/http.ts",
    "../analysis/cache.ts",
    "../data/range-file.ts",
  ]) {
    const url = new URL(module, import.meta.url).href;
    const result = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        `
      Object.defineProperty(process.versions, 'node', { value: '24.22.0' });
      globalThis.fetch = () => { throw new Error('Unexpected network access'); };
      await import(${JSON.stringify(url)});
    `,
      ],
      { encoding: "utf8", timeout: 10000 },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /CVE-2026-111497/);
    assert.doesNotMatch(result.stderr, /Unexpected network access/);
  }
});
