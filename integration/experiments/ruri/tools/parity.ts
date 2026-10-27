/** Compares real browser Q8 output with independently tokenized native F32 output. */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { preview } from "vite";
import { assertBuild } from "./build-check.ts";
import { sourceIdentity } from "./identity.ts";
import { sha256 } from "./pinned.ts";
import { assertReference } from "./reference-check.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const reference = JSON.parse(
  await readFile(resolve(root, "results/native-reference.json"), "utf8"),
) as {
  modelLockSha256: string;
  referenceScriptSha256: string;
  pythonLockSha256: string;
  inputSha256: string;
  records: {
    text: string;
    role: "query" | "document";
    tokens: number[];
    vector: number[];
  }[];
};
assert.equal(
  reference.modelLockSha256,
  sha256(await readFile(resolve(root, "model.lock.json"))),
  "stale native reference profile",
);
await assertReference(root, reference, "reference-inputs.json");
const server = await preview({
  root,
  preview: { host: "127.0.0.1", port: 4198, strictPort: true },
});
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  browser = await chromium.launch();
  const context = await browser.newContext();
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === "http://127.0.0.1:4198"
      ? route.continue()
      : route.abort(),
  );
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4198");
  await page.waitForFunction(() => "ruriProbe" in globalThis);
  await assertBuild(page, root);
  const results = [];
  for (const entry of reference.records) {
    const actual = await page.evaluate(async (item) => {
      const probe = (
        globalThis as unknown as {
          ruriProbe: {
            request: (
              text: string,
              role: "query" | "document",
            ) => Promise<{ tokens: number[]; vector: number[] }>;
          };
        }
      ).ruriProbe;
      return probe.request(item.text, item.role);
    }, entry);
    assert.deepEqual(actual.tokens, entry.tokens, "tokenizer mismatch");
    let dot = 0,
      left = 0,
      right = 0,
      maxError = 0;
    assert.equal(actual.vector.length, entry.vector.length);
    for (let i = 0; i < actual.vector.length; i++) {
      const a = actual.vector[i] ?? NaN,
        b = entry.vector[i] ?? NaN;
      dot += a * b;
      left += a * a;
      right += b * b;
      maxError = Math.max(maxError, Math.abs(a - b));
    }
    const cosine = dot / Math.sqrt(left * right);
    assert.ok(cosine >= 0.99, `Q8/reference cosine ${cosine}`);
    results.push({
      text: entry.text,
      role: entry.role,
      tokens: entry.tokens.length,
      cosine,
      maxError,
    });
  }
  await assertBuild(page, root);
  const record = {
    schema: 1,
    referenceSha256: sha256(
      await readFile(resolve(root, "results/native-reference.json")),
    ),
    sourceFilesSha256: await sourceIdentity(root),
    referenceModelLock: reference.modelLockSha256,
    browser: browser.version(),
    threshold: 0.99,
    results,
  };
  await writeFile(
    resolve(root, "results/native-parity.json"),
    `${JSON.stringify(record, null, 2)}\n`,
  );
  process.stdout.write(
    `${JSON.stringify({ checked: results.length, minCosine: Math.min(...results.map((item) => item.cosine)), tokenizers: "identical" })}\n`,
  );
} finally {
  await browser?.close();
  await new Promise<void>((done, reject) =>
    server.httpServer.close((error) => (error ? reject(error) : done())),
  );
}
