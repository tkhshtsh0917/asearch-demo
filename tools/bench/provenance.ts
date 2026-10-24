/** Identifies code and publication data and verifies that the benchmark serves those bytes. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { readBody } from "../engine/http.ts";

export type Artifacts = Record<string, { bytes: number; sha256: string }>;
const digest = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

/** Captures every code/data asset, including query rules, manifests and analysis provenance. */
export async function artifacts(root: URL): Promise<Artifacts> {
  const names = ["index.html"];
  for (const folder of ["assets", "data"]) {
    for (const entry of await readdir(new URL(`${folder}/`, root), {
      withFileTypes: true,
    })) {
      if (!entry.isFile())
        throw new Error("Benchmark artifact must be a regular file");
      names.push(`${folder}/${entry.name}`);
    }
  }
  const output: Artifacts = {};
  for (const name of names.sort()) {
    const path = new URL(name, root);
    if ((await stat(path)).size > 64 * 1024 * 1024)
      throw new Error("Benchmark artifact exceeds 64 MiB");
    const bytes = await readFile(path);
    if (bytes.length > 64 * 1024 * 1024)
      throw new Error("Benchmark artifact exceeds 64 MiB");
    output[name] = { bytes: bytes.length, sha256: digest(bytes) };
  }
  return output;
}

/** Bounds each HTTP body by the captured file length before accepting its hash. */
export async function verifyServed(
  base: URL,
  expected: Artifacts,
  fetcher: (url: URL) => Promise<Response> = (url) =>
    fetch(url, {
      credentials: "omit",
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    }),
): Promise<void> {
  for (const [name, entry] of Object.entries(expected)) {
    const url = new URL(
      name.split("/").map(encodeURIComponent).join("/"),
      base,
    );
    const bytes = await readBody(
      await fetcher(url),
      entry.bytes,
      "Benchmark artifact",
    );
    assert.equal(
      digest(bytes),
      entry.sha256,
      `Served benchmark artifact differs: ${name}`,
    );
  }
}

export function unchanged(before: Artifacts, after: Artifacts): void {
  assert.deepEqual(
    after,
    before,
    "Benchmark artifacts changed during measurement",
  );
}
