/** Measures local asset loading and real browser CPU inference without remote requests. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { arch, cpus, platform } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type Browser,
  chromium,
  devices,
  firefox,
  type Page,
  webkit,
} from "@playwright/test";
import { preview } from "vite";
import { assertBuild } from "./build-check.ts";
import { sourceIdentity } from "./identity.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const project = process.argv[2] ?? "chromium";
const choices = {
  chromium: { engine: chromium, context: {} },
  firefox: { engine: firefox, context: {} },
  webkit: { engine: webkit, context: {} },
  "android-profile": { engine: chromium, context: devices["Pixel 7"] },
  "iphone-profile": { engine: webkit, context: devices["iPhone 13"] },
};
if (!(project in choices)) throw new Error("Unknown browser profile");
const choice = choices[project as keyof typeof choices];

const queries = [
  "日本で一番高い山は？",
  "申し込みを取り消したい",
  "びーt",
  "瑠璃色はどんな色？",
  "電車を乗り過ごしたらどうすればよい？",
];

type Sample = {
  tokenCount: number;
  tokenizationMs: number;
  encodeMs: number;
  roundTripMs: number;
  vector: number[];
};
async function encode(
  page: Page,
  text: string,
  role: "query" | "document" = "query",
): Promise<Sample> {
  const result = (await page.evaluate(
    async ({ text, role }) => {
      const api = (
        globalThis as unknown as {
          ruriProbe: {
            request: (
              query: string,
              role: "query" | "document",
            ) => Promise<unknown>;
          };
        }
      ).ruriProbe;
      return await api.request(text, role);
    },
    { text, role },
  )) as Sample;
  assert.equal(result.vector.length, 256);
  assert.ok(result.vector.every(Number.isFinite));
  const squared = result.vector.reduce((sum, value) => sum + value * value, 0);
  assert.ok(Math.abs(Math.sqrt(squared) - 1) < 1e-5);
  for (const value of [
    result.encodeMs,
    result.tokenizationMs,
    result.roundTripMs,
  ])
    assert.ok(Number.isFinite(value) && value >= 0);
  return result;
}

const server = await preview({
  root,
  preview: { host: "127.0.0.1", port: 4198, strictPort: true },
});
let browser: Browser | undefined;
try {
  browser = await choice.engine.launch();
  const context = await browser.newContext(choice.context);
  const origin = "http://127.0.0.1:4198";
  const remoteRequests: string[] = [];
  const localRequests: string[] = [];
  const allowedPaths = new Set([
    "/",
    ...(await readdir(resolve(root, "dist"), { recursive: true })).map(
      (path) => `/${path}`,
    ),
  ]);
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (
      url.origin !== origin ||
      !allowedPaths.has(url.pathname) ||
      url.search ||
      route.request().method() !== "GET"
    ) {
      remoteRequests.push(
        `${route.request().method()} ${url.origin}${url.pathname}`,
      );
      return route.abort();
    }
    localRequests.push(url.pathname);
    return route.continue();
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin);
  await page.waitForFunction(() => "ruriProbe" in globalThis);
  await assertBuild(page, root);
  const measuredIdentity = await sourceIdentity(root);
  await page.evaluate(() =>
    Object.defineProperty(
      (globalThis as unknown as { ruriProbe: object }).ruriProbe,
      "sourceIdentity",
      { value: "stale", configurable: true },
    ),
  );
  await assert.rejects(() => assertBuild(page, root), /does not match source/);
  await page.evaluate(
    (value) =>
      Object.defineProperty(
        (globalThis as unknown as { ruriProbe: object }).ruriProbe,
        "sourceIdentity",
        { value, configurable: true },
      ),
    measuredIdentity,
  );
  const initialized = await page.evaluate(async () => {
    const api = (
      globalThis as unknown as {
        ruriProbe: { request: () => Promise<unknown> };
      }
    ).ruriProbe;
    return await api.request();
  });

  const first = await encode(page, queries[0] ?? "日本");
  // A validation error must leave the loaded session usable.
  await assert.rejects(() => encode(page, ""), /Empty input/);
  await assert.rejects(() => encode(page, "あ ".repeat(300)), /Token limit/);
  const document = await encode(
    page,
    "富士山は日本で最も高い山です。",
    "document",
  );
  for (const query of queries) await encode(page, query);
  const samples = [];
  for (let repeat = 0; repeat < 20; repeat++) {
    for (const query of queries) {
      const { vector, ...timing } = await encode(page, query);
      const vectorHash = createHash("sha256")
        .update(new Uint8Array(Float32Array.from(vector).buffer))
        .digest("hex");
      samples.push({ query, repeat, ...timing, vectorHash });
    }
  }
  assert.deepEqual(remoteRequests, []);
  assert.deepEqual(errors, []);
  assert.ok(localRequests.some((path) => path.endsWith("model.onnx")));
  const percentile = (values: number[], p: number) =>
    values.toSorted((a, b) => a - b)[Math.ceil(values.length * p) - 1];
  const sourceRevision = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  await assertBuild(page, root);
  const result = {
    schema: 1,
    recordedAt: new Date().toISOString(),
    project,
    browser: browser.version(),
    host: {
      platform: platform(),
      architecture: arch(),
      cpu: cpus()[0]?.model,
      node: process.version,
    },
    sourceRevision,
    sourceFilesSha256: await sourceIdentity(root),
    sourceDirty:
      execFileSync("git", ["status", "--porcelain"], {
        cwd: root,
        encoding: "utf8",
      }).trim().length > 0,
    conditions: {
      backend: "wasm",
      threads: 1,
      network: "local-loopback",
      httpCache: "disabled-by-request-routing",
      warmup: queries.length,
      measured: samples.length,
      tokenLimit: 256,
    },
    assets: JSON.parse(
      await readFile(resolve(root, "public/assets.json"), "utf8"),
    ),
    initialized,
    first,
    document,
    samples,
    summary: {
      encodeP50Ms: percentile(
        samples.map((s) => s.encodeMs),
        0.5,
      ),
      encodeP95Ms: percentile(
        samples.map((s) => s.encodeMs),
        0.95,
      ),
      roundTripP95Ms: percentile(
        samples.map((s) => s.roundTripMs),
        0.95,
      ),
    },
    networkChecks: {
      remoteRequests,
      localRequests: [...new Set(localRequests)],
    },
    scope:
      "Encoder warm latency only; independent parity, labeled retrieval quality and cold/cache/memory records are separate experiments.",
  };
  const output = resolve(root, "results");
  await mkdir(output, { recursive: true });
  await writeFile(
    resolve(output, `${project}.json`),
    `${JSON.stringify(result, null, 2)}\n`,
  );
  process.stdout.write(
    `${JSON.stringify({ project, initialized, summary: result.summary }, null, 2)}\n`,
  );
} finally {
  await browser?.close();
  await new Promise<void>((done, reject) =>
    server.httpServer.close((error) => (error ? reject(error) : done())),
  );
}
