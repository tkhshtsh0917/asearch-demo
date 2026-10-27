/** Measures committed input through accepted DOM rendering against an immutable built site. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { preview } from "vite";
import { siteHashes } from "../site/artifact.ts";

const before = await siteHashes("dist"),
  script = await readFile(new URL(import.meta.url));
const server = await preview({
    preview: { host: "127.0.0.1", port: 0, strictPort: true },
  }),
  browser = await chromium.launch();
try {
  const address = server.httpServer.address();
  assert.ok(address && typeof address !== "string");
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const start = performance.now();
  await page.goto(`http://127.0.0.1:${address.port}/asearch-demo/`);
  await page.waitForFunction(() =>
    document.querySelector("#status")?.textContent?.includes("検索できます"),
  );
  const primaryReadyMs = performance.now() - start;
  const manual = () =>
    page.evaluate(async () => {
      const results = document.getElementById("semantic-results"),
        button = document.getElementById("semantic-enable");
      if (!results || !button) throw new Error("Missing semantic controls");
      const began = performance.now();
      return new Promise<number>((resolve, reject) => {
        const timer = setTimeout(() => {
          observer.disconnect();
          reject(new Error("Semantic render timeout"));
        }, 180000);
        const observer = new MutationObserver(() => {
          clearTimeout(timer);
          observer.disconnect();
          resolve(performance.now() - began);
        });
        observer.observe(results, {
          attributes: true,
          attributeFilter: ["data-token"],
        });
        button.click();
      });
    });
  await page.locator("#query").fill("日本");
  await page.waitForFunction(
    () => document.querySelectorAll("#results li").length > 0,
  );
  const firstRequests: string[] = [];
  page.on("request", (request) =>
    firstRequests.push(new URL(request.url()).pathname),
  );
  const firstExplicitMs = await manual();
  const firstPaths = [...new Set(firstRequests)];
  const firstDecodedBytes = (
    await Promise.all(
      firstPaths.map(async (path) => {
        assert.ok(path.startsWith("/asearch-demo/"));
        return (await stat(`dist/${path.slice("/asearch-demo/".length)}`)).size;
      }),
    )
  ).reduce((a, b) => a + b, 0);
  const phrases = [
    "氷の惑星で野菜を育てたい",
    "未来の図書館で星を眺めたい",
    "海底で新しい道具を試したい",
    "架空の森で楽器を演奏したい",
    "遠い銀河の町で暮らしたい",
  ];
  const samples: number[] = [];
  for (let i = 0; i < 45; i++) {
    const phrase = phrases[i % phrases.length];
    assert.ok(phrase);
    const ms = await page.evaluate(async (text) => {
      const input = document.getElementById("query") as HTMLInputElement,
        results = document.getElementById("semantic-results");
      if (!results) throw new Error("Missing semantic rows");
      const began = performance.now();
      return new Promise<number>((resolve, reject) => {
        const timer = setTimeout(() => {
          observer.disconnect();
          reject(new Error("Automatic semantic render timeout"));
        }, 10000);
        const observer = new MutationObserver(() => {
          clearTimeout(timer);
          observer.disconnect();
          resolve(performance.now() - began);
        });
        observer.observe(results, {
          attributes: true,
          attributeFilter: ["data-token"],
        });
        input.value = text;
        input.dispatchEvent(new InputEvent("input", { bubbles: true }));
      });
    }, phrase);
    assert.match(
      (await page.locator("#metrics").textContent()) ?? "",
      /^0件一致/,
    );
    if (i >= 5) samples.push(ms);
  }
  samples.sort((a, b) => a - b);
  assert.deepEqual(errors, []);
  assert.deepEqual(await siteHashes("dist"), before);
  assert.equal(
    createHash("sha256")
      .update(await readFile(new URL(import.meta.url)))
      .digest("hex"),
    createHash("sha256").update(script).digest("hex"),
  );
  const record = {
    schema: 1,
    revision: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    sourceDirty:
      execFileSync("git", ["status", "--porcelain"], {
        encoding: "utf8",
      }).trim().length > 0,
    scriptSha256: createHash("sha256").update(script).digest("hex"),
    builtSiteFiles: before,
    browser: browser.version(),
    primaryReadyMs,
    firstExplicitMs,
    firstDecodedBytes,
    firstPaths,
    samples,
    p50: samples[19],
    p95: samples[37],
    conditions:
      "Loopback; real encoder + exact 10k vectors; explicit first activation; five warmups and forty automatic zero-lexical committed inputs; includes 150ms debounce, lexical/semantic queueing and accepted DOM mutation; not relevance evaluation or a network cold p95",
  };
  await mkdir(".semantic/results", { recursive: true });
  await writeFile(
    ".semantic/results/interaction-chromium.json",
    `${JSON.stringify(record, null, 2)}\n`,
  );
  console.log(
    JSON.stringify({
      primaryReadyMs,
      firstExplicitMs,
      p50: record.p50,
      p95: record.p95,
    }),
  );
} finally {
  await browser.close();
  await new Promise<void>((resolve, reject) =>
    server.httpServer.close((e) => (e ? reject(e) : resolve())),
  );
}
