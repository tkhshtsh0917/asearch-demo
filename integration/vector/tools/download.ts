/** Fetches a caller-pinned public Linux Release Asset for explicit consumer conformance. */
import "../../../tools/security/runtime.ts";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { bundleRoot, releaseFiles } from "./archive.ts";

const url = process.argv[2],
  expected = process.argv[3];
assert.ok(url && expected && url.length <= 2048);
assert.match(expected, /^[a-f0-9]{64}$/);
assert.match(
  url,
  /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/releases\/download\/v[0-9][A-Za-z0-9_.-]*\/vector-store-x86_64-unknown-linux-gnu\.tar\.gz$/,
);
const response = await fetch(url, {
  signal: AbortSignal.timeout(120000),
  credentials: "omit",
});
const final = new URL(response.url);
assert.ok(
  final.protocol === "https:" &&
    ["github.com", "release-assets.githubusercontent.com"].includes(
      final.hostname,
    ),
);
if (!response.ok || !response.body) {
  void response.body?.cancel().catch(() => {});
  throw new Error("Release unavailable");
}
const chunks: Uint8Array[] = [];
let total = 0;
for await (const chunk of response.body) {
  total += chunk.length;
  if (total > 128 * 1024 ** 2) throw new Error("Release transfer limit");
  chunks.push(chunk);
}
const bytes = Buffer.concat(chunks, total);
assert.equal(createHash("sha256").update(bytes).digest("hex"), expected);
const files = releaseFiles(bytes),
  directory = resolve(".data/releases", expected, bundleRoot);
await mkdir(directory, { recursive: true });
for (const [name, content] of files) {
  const output = resolve(directory, name);
  try {
    const existing = await readFile(output);
    assert.deepEqual(existing, content);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await writeFile(output, content, {
      flag: "wx",
      mode: name === "vector-store" ? 0o755 : 0o644,
    });
  }
}
console.log(`.data/releases/${expected}/${bundleRoot}`);
