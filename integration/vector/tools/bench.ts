/** Measures an explicitly built adapter artifact against a fixed 10k native oracle. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { preview } from "vite";
import type { Harness } from "../src/harness.ts";

const root = fileURLToPath(new URL("../", import.meta.url)),
  out = process.argv[2] ?? "dist",
  label = process.argv[3] ?? "candidate";
assert.match(label, /^[a-z0-9-]+$/);
const rows = Number(process.argv[4] ?? 10000);
assert.ok([10000, 50000].includes(rows));
const html = await readFile(resolve(root, out, "index.html"), "utf8");
const script = /src="([^"]+\.js)"/.exec(html)?.[1];
assert.ok(script);
const sha = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const jsHash = sha(await readFile(resolve(root, out, script.slice(1))));
const wasmHash = sha(
  await readFile(resolve(root, out, "bindings/vector_wasm_bg.wasm")),
);
const source = JSON.parse(
  await readFile(resolve(root, ".artifacts/release.json"), "utf8"),
);
const server = await preview({
    root,
    build: { outDir: out },
    preview: { host: "127.0.0.1", port: 4199, strictPort: true },
  }),
  browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:4199");
  await page.waitForFunction(() => "vectorHarness" in globalThis);
  const result = await page.evaluate(async (rows) => {
    const api = (globalThis as unknown as { vectorHarness: Harness })
        .vectorHarness,
      c = await api.create(rows === 50000);
    const name = rows === 10000 ? "bulk" : "bulk50k";
    try {
      const began = performance.now(),
        h = await api.prepare(c, name),
        loadMs = performance.now() - began;
      const query = await (await fetch(`/fixtures/${name}-query.json`)).json();
      const expected = await (
        await fetch(`/fixtures/${name}-oracle.json`)
      ).json();
      const samples: number[] = [];
      for (let i = 0; i < 45; i++) {
        const start = performance.now();
        const result = await c.search(h, new Float32Array(query), 10);
        const elapsed = performance.now() - start;
        if (
          JSON.stringify(result.candidates) !==
          JSON.stringify(expected.candidates)
        )
          throw new Error("Native oracle mismatch");
        if (i >= 5) samples.push(elapsed);
      }
      samples.sort((a, b) => a - b);
      return {
        loadMs,
        samples,
        p50: samples[19],
        p95: samples[37],
        resources: c.resources(),
      };
    } finally {
      c.dispose();
    }
  }, rows);
  const record = {
    schema: 1,
    label,
    adapterJsSha256: jsHash,
    wasmSha256: wasmHash,
    source,
    rows,
    dimensions: 256,
    k: 10,
    browser: browser.version(),
    conditions:
      "Loopback; 5 warmups, 40 identical native-query repetitions; cooperative yields included; encoding excluded; exact native candidate comparison outside timer",
    ...result,
  };
  await writeFile(
    resolve(root, `results/bench-${label}.json`),
    `${JSON.stringify(record, null, 2)}\n`,
  );
  console.log(
    JSON.stringify({
      label,
      loadMs: result.loadMs,
      p50: result.p50,
      p95: result.p95,
    }),
  );
} finally {
  await browser.close();
  await server.httpServer?.close();
}
