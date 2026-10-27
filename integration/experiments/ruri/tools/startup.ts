/** Separates fresh download, persistent-cache initialization and corrupt-cache recovery. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, firefox, type Page, webkit } from "@playwright/test";
import lock from "../model.lock.json" with { type: "json" };
import runtime from "../runtime.lock.json" with { type: "json" };
import { assertBuild } from "./build-check.ts";
import { sourceIdentity } from "./identity.ts";
import { staticServer } from "./static-server.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const project = process.argv[2] ?? "chromium";
const engine = { chromium, firefox, webkit }[project];
if (!engine) throw new Error("Unknown startup browser");
const simulated = process.argv.includes("--throttle");
const cachedFiles = [
  ...lock.files,
  ...runtime.files.filter((file) => file.path.endsWith(".wasm")),
];
if (simulated && project !== "chromium")
  throw new Error("Throttling requires Chromium");

// Fixed before measurement; host-browser limits do not imply a physical-mobile guarantee.
const acceptance = {
  coldMs: 90_000,
  cachedMs: 10_000,
  warmMs: 100,
  rssBytes: 1024 ** 3,
  fetchedBytes: 64 * 1024 ** 2,
};
const server = await staticServer(
  new URL("../dist", import.meta.url).pathname,
  simulated,
);
const browserServer = await engine.launchServer();
const browser = await engine.connect(browserServer.wsEndpoint());
const pid = browserServer.process().pid;
let rssPeak = 0;
let rssCurrent = 0;
const phases: Record<string, number> = {};
function sampleRss() {
  if (!pid) return;
  const rows = execFileSync("ps", ["-axo", "pid=,ppid=,rss="], {
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .map((line) => line.trim().split(/\s+/).map(Number));
  const owned = new Set([pid]);
  for (let pass = 0; pass < rows.length; pass++) {
    let changed = false;
    for (const [child, parent] of rows)
      if (child && parent && owned.has(parent) && !owned.has(child)) {
        owned.add(child);
        changed = true;
      }
    if (!changed) break;
  }
  const bytes = rows.reduce(
    (sum, [child, , rss]) =>
      sum + (child && rss && owned.has(child) ? rss * 1024 : 0),
    0,
  );
  rssPeak = Math.max(rssPeak, bytes);
  rssCurrent = bytes;
}
const sampler = setInterval(sampleRss, 100);
sampleRss();
phases.browserLaunched = rssCurrent;
type Reply = {
  initialization: {
    cacheHits: number;
    fetchedDecodedBytes: number;
    readyMs: number;
    cache: {
      readFailures: number;
      writeFailures: number;
      writeSkips: number;
      lastFailure: string;
    };
  };
  roundTripMs: number;
};
async function initialize(page: Page): Promise<Reply> {
  await page.evaluate(async () => {
    const api = (
      globalThis as unknown as { ruriProbe?: { dispose(): Promise<void> } }
    ).ruriProbe;
    await api?.dispose();
  });
  await page.goto("http://127.0.0.1:4198");
  await page.waitForFunction(() => "ruriProbe" in globalThis);
  await assertBuild(page, root);
  return page.evaluate(() =>
    (
      globalThis as unknown as { ruriProbe: { request: () => Promise<Reply> } }
    ).ruriProbe.request(),
  );
}
async function infer(page: Page) {
  return page.evaluate(() =>
    (
      globalThis as unknown as {
        ruriProbe: { request(text: string): Promise<{ roundTripMs: number }> };
      }
    ).ruriProbe.request("申請を取り消したい"),
  );
}

try {
  const context = await browser.newContext();
  const fetched: string[] = [];
  context.on("request", (request) => {
    const url = new URL(request.url());
    assert.equal(url.origin, "http://127.0.0.1:4198", "unexpected destination");
    assert.equal(url.search, "", "query-bearing network request");
    fetched.push(url.pathname);
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const start = performance.now();
  const fresh = await initialize(page);
  sampleRss();
  phases.fresh = rssCurrent;
  const navigationThroughReadyMs = performance.now() - start;
  const freshFirst = await infer(page);
  const navigationThroughFirstInferenceMs = performance.now() - start;
  assert.equal(fresh.initialization.cacheHits, 0);
  assert.equal(
    fresh.initialization.fetchedDecodedBytes,
    cachedFiles.reduce((sum, file) => sum + file.bytes, 0),
  );

  const firstTransferBytes = server.counters.decodedBytesWritten;
  const freshRequests = [...fetched];
  let fetchedBytes = 0;
  for (const path of freshRequests) {
    assert.ok(!path.includes(".."));
    fetchedBytes += (
      await stat(
        new URL(
          `../dist/${path === "/" ? "index.html" : path.slice(1)}`,
          import.meta.url,
        ),
      )
    ).size;
  }
  fetched.length = 0;
  const cached = await initialize(page);
  sampleRss();
  phases.cached = rssCurrent;
  const cachedFirst = await infer(page);
  const cacheAvailable = cached.initialization.cacheHits === cachedFiles.length;
  if (cacheAvailable) {
    assert.equal(cached.initialization.fetchedDecodedBytes, 0);
    assert.ok(!fetched.some((path) => path.startsWith("/models/")));
  } else {
    assert.ok(
      cached.initialization.cache.readFailures +
        cached.initialization.cache.writeFailures +
        cached.initialization.cache.writeSkips >
        0,
      "Unexpected silent cache miss",
    );
  }
  let recovered: Reply | undefined;
  if (cacheAvailable) {
    // Same size but wrong content must be rejected, then replaced by verified bytes.
    const corruptFile = lock.files[1];
    assert.ok(corruptFile);
    await page.evaluate(async (file) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("ruri-pinned-assets-v1", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("assets", "readwrite");
          tx.objectStore("assets").put(
            new Blob([new Uint8Array(file.bytes)]),
            file.sha256,
          );
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onabort = () => {
            db.close();
            reject(tx.error);
          };
        };
      });
    }, corruptFile);
    recovered = await initialize(page);
    sampleRss();
    phases.recovered = rssCurrent;
    await infer(page);
    assert.equal(recovered.initialization.cacheHits, cachedFiles.length - 1);
    assert.equal(
      recovered.initialization.fetchedDecodedBytes,
      lock.files[1]?.bytes,
    );
  }
  const warm = await page.evaluate(async () =>
    (
      globalThis as unknown as {
        ruriProbe: {
          request: (text: string) => Promise<{ roundTripMs: number }>;
        };
      }
    ).ruriProbe.request("申請を取り消したい"),
  );

  const artifacts = JSON.parse(
    await readFile(new URL("../public/assets.json", import.meta.url), "utf8"),
  );
  sampleRss();
  assert.deepEqual(errors, []);
  await assertBuild(page, root);
  const record = {
    schema: 1,
    recordedAt: new Date().toISOString(),
    sourceFilesSha256: await sourceIdentity(root),
    browser: browser.version(),
    project,
    acceptance,
    cacheAvailable,
    gates: {
      cold: navigationThroughFirstInferenceMs <= acceptance.coldMs,
      cached:
        cacheAvailable &&
        cached.roundTripMs + cachedFirst.roundTripMs <= acceptance.cachedMs,
      warm: warm.roundTripMs <= acceptance.warmMs,
      rss:
        project === "webkit"
          ? null
          : rssPeak > 0 && rssPeak <= acceptance.rssBytes,
      decoded: fetchedBytes <= acceptance.fetchedBytes,
    },
    conditions: {
      network: simulated
        ? "Server simulation: shared 10 Mbps body-byte rate, 80ms first-byte delay, localhost"
        : "loopback",
      httpCache:
        "browser default cache; test server Cache-Control max-age=3600",
      rss: "100ms samples: owned browser process subtree, summed RSS; may double-count shared pages; not a true peak or WASM-only memory. WebKit on macOS can launch content processes outside this subtree: comparable total unavailable.",
    },
    navigationThroughReadyMs,
    navigationThroughFirstInferenceMs,
    freshFirst,
    cachedFirst,
    fetchedBytes,
    firstTransferBytes,
    freshRequests,
    fresh,
    cached,
    recovered,
    warm,
    rssPeak,
    phases,
    artifacts,
  };
  await writeFile(
    new URL(
      `../results/startup-${project}${simulated ? "-throttled" : ""}.json`,
      import.meta.url,
    ),
    `${JSON.stringify(record, null, 2)}\n`,
  );
  if (process.argv.includes("--require-budget"))
    assert.ok(
      Object.values(record.gates).every(Boolean),
      "Encoder acceptance target failed; see saved measurements",
    );
  process.stdout.write(
    `${JSON.stringify({ project, simulated, navigationThroughReadyMs, cachedMs: cached.roundTripMs, rssPeak, gates: record.gates, cacheAvailable })}\n`,
  );
} finally {
  clearInterval(sampler);
  await browser.close();
  await browserServer.close();
  await server.close();
}
