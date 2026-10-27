/** Reuses only native document vectors whose consumed questions and locked encoder match. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, rm, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Question } from "../../src/shared/catalog.ts";

const digest = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");

export function questionInput(rows: readonly Question[]) {
  return `${rows.map(({ key, text }) => JSON.stringify({ key, text })).join("\n")}\n`;
}
export function cacheMatches(
  meta: Record<string, unknown>,
  expected: Record<string, unknown>,
) {
  return Object.entries(expected).every(([key, value]) => meta[key] === value);
}
export async function prepareDocuments(
  root: string,
  base: Question[],
  changes: Question[],
) {
  const workspace = resolve(root, ".semantic"),
    integration = resolve(root, "integration/vector"),
    ruri = resolve(root, "integration/experiments/ruri");
  const inputs = [
    resolve(ruri, "model.lock.json"),
    resolve(integration, "tools/embed.py"),
    resolve(integration, "tools/embed.py.lock"),
  ];
  const captured = await Promise.all(inputs.map((file) => readFile(file)));
  const [model, script, lock] = captured;
  assert.ok(model && script && lock);
  const common = {
    modelLockSha256: digest(model),
    scriptSha256: digest(script),
    pythonLockSha256: digest(lock),
    dimensions: 256,
    backend: "cpu-f32-eager",
    threads: 1,
    batchSize: 16,
  };
  for (const [name, rows] of [
    ["base", base],
    ["updates", changes],
  ] as const) {
    const input = resolve(workspace, `${name}-questions.jsonl`),
      vectors = resolve(workspace, `${name}-vectors.jsonl`),
      metadata = vectors.replace(".jsonl", ".metadata.json");
    const text = questionInput(rows);
    await writeFile(input, text);
    const expected = {
      ...common,
      rows: rows.length,
      questionInputSha256: digest(text),
    };
    const valid = async () => {
      if (
        (await stat(metadata)).size > 65536 ||
        (await stat(vectors)).size > 64 * 1024 ** 2
      )
        throw new Error("Native vector cache byte limit");
      const meta = JSON.parse(await readFile(metadata, "utf8"));
      return (
        cacheMatches(meta, expected) &&
        meta.embeddingJsonlSha256 === digest(await readFile(vectors))
      );
    };
    let cached = false;
    try {
      cached = await valid();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (!cached) {
      await rm(vectors, { force: true });
      await rm(metadata, { force: true });
      execFileSync(
        "mise",
        [
          "exec",
          "--",
          "uv",
          "run",
          "--script",
          "--locked",
          "tools/embed.py",
          "--input",
          input,
          "--output",
          vectors,
          "--limit",
          String(rows.length),
        ],
        { cwd: integration, stdio: "inherit" },
      );
      assert.ok(await valid(), "Executed document encoder identity changed");
    }
  }
  const final = await Promise.all(inputs.map((file) => readFile(file)));
  assert.deepEqual(
    final.map(digest),
    captured.map(digest),
    "Document encoder changed during publication",
  );
}
