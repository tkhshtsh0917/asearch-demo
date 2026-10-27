/** Evaluates browser Q8 queries against native F32 documents on pinned labeled retrieval cases. */
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

type Entry = {
  id: string;
  text: string;
  role: "query" | "document";
  tokens: number[];
  vector: number[];
};
const root = fileURLToPath(new URL("../", import.meta.url));
const reference = JSON.parse(
  await readFile(resolve(root, "results/quality-reference.json"), "utf8"),
) as {
  modelLockSha256: string;
  referenceScriptSha256: string;
  pythonLockSha256: string;
  inputSha256: string;
  records: Entry[];
  quality: {
    qrels: { id: string; relevant: string[] }[];
    pin: unknown;
    documentCount: number;
    queryCount: number;
    droppedBeforeSelection: number;
  };
};
const docs = reference.records.filter((item) => item.role === "document");
assert.equal(
  reference.modelLockSha256,
  sha256(await readFile(resolve(root, "model.lock.json"))),
  "stale quality reference profile",
);
const queries = reference.records.filter((item) => item.role === "query");
const qrels = new Map(
  reference.quality.qrels.map((item) => [item.id, new Set(item.relevant)]),
);

function ranking(vector: number[]) {
  return docs
    .map((doc) => {
      let score = 0;
      for (let i = 0; i < vector.length; i++)
        score += (vector[i] ?? NaN) * (doc.vector[i] ?? NaN);
      assert.ok(Number.isFinite(score));
      return { id: doc.id, score };
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
function metrics(
  ranked: { id: string; score: number }[],
  relevant: Set<string>,
) {
  const hits = ranked
    .slice(0, 10)
    .filter((item) => relevant.has(item.id)).length;
  const dcg = ranked
    .slice(0, 10)
    .reduce(
      (sum, item, index) =>
        sum + (relevant.has(item.id) ? 1 / Math.log2(index + 2) : 0),
      0,
    );
  const ideal = Array.from(
    { length: Math.min(10, relevant.size) },
    (_, i) => 1 / Math.log2(i + 2),
  ).reduce((a, b) => a + b, 0);
  return { recall10: hits / relevant.size, ndcg10: dcg / ideal };
}
await assertReference(root, reference, ".reference/quality/source.json");
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
  const samples: {
    id: string;
    reference: ReturnType<typeof metrics>;
    browser: ReturnType<typeof metrics>;
  }[] = [];
  for (const query of queries) {
    const actual = await page.evaluate(
      async (text) =>
        (
          globalThis as unknown as {
            ruriProbe: {
              request: (
                text: string,
              ) => Promise<{ tokens: number[]; vector: number[] }>;
            };
          }
        ).ruriProbe.request(text),
      query.text,
    );
    assert.deepEqual(actual.tokens, query.tokens, "quality tokenizer parity");
    const relevant = qrels.get(query.id);
    assert.ok(relevant?.size);
    samples.push({
      id: query.id,
      reference: metrics(ranking(query.vector), relevant),
      browser: metrics(ranking(actual.vector), relevant),
    });
  }
  const average = (
    backend: "reference" | "browser",
    key: "recall10" | "ndcg10",
  ) =>
    samples.reduce((sum, item) => sum + item[backend][key], 0) / samples.length;
  const summary = {
    native: {
      recall10: average("reference", "recall10"),
      ndcg10: average("reference", "ndcg10"),
    },
    browser: {
      recall10: average("browser", "recall10"),
      ndcg10: average("browser", "ndcg10"),
    },
  };
  assert.ok(
    summary.browser.recall10 >= summary.native.recall10 - 0.02,
    "recall regression",
  );
  assert.ok(
    summary.browser.ndcg10 >= summary.native.ndcg10 - 0.02,
    "nDCG regression",
  );
  await assertBuild(page, root);
  await writeFile(
    resolve(root, "results/quality.json"),
    `${JSON.stringify({ schema: 1, referenceSha256: sha256(await readFile(resolve(root, "results/quality-reference.json"))), sourceFilesSha256: await sourceIdentity(root), browser: browser.version(), selection: reference.quality, summary, samples, scope: "Token-eligible fixed subset, not full JMTEB or a claim of no-answer accuracy." }, null, 2)}\n`,
  );
  process.stdout.write(
    `${JSON.stringify({ queries: samples.length, documents: docs.length, summary })}\n`,
  );
} finally {
  await browser?.close();
  await new Promise<void>((done, reject) =>
    server.httpServer.close((error) => (error ? reject(error) : done())),
  );
}
