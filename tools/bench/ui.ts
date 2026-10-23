/** Measures Worker round trips and accepted DOM mutations on an already-built demo. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { cpus, platform } from "node:os";
import { chromium, firefox, webkit } from "@playwright/test";

import { installObservation, type Observation } from "./observe.ts";

const [url, output] = process.argv.slice(2);
if (
  !url ||
  !output ||
  !["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname)
)
  throw new Error(
    "Usage: node tools/bench/ui.ts LOOPBACK_DEMO_URL OUTPUT_JSON",
  );

const sha = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const artifacts: Record<string, string> = {};
for (const name of await readdir(
  new URL("../../dist/assets/", import.meta.url),
)) {
  if (/\.(js|wasm|css)$/.test(name))
    artifacts[`assets/${name}`] = sha(
      await readFile(new URL(`../../dist/assets/${name}`, import.meta.url)),
    );
}
artifacts["index.html"] = sha(
  await readFile(new URL("../../dist/index.html", import.meta.url)),
);
const results = [];
for (const [name, type] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await type.launch();
  try {
    const page = await browser.newPage();
    await page.addInitScript(installObservation);
    await page.goto(url);
    await page.locator("#status").filter({ hasText: "検索できます" }).waitFor();
    await page.waitForFunction(() =>
      document
        .querySelector("#metrics")
        ?.textContent?.includes("入力してください"),
    );
    // Settle each query before the next; rapid-input correctness belongs to E2E tests.
    const inputs = [
      "日",
      "日本",
      "日本の",
      "日本の歴",
      "日本の歴史",
      "日本の",
      "地理",
      "大学",
    ];
    for (let round = 0; round < 28; round++) {
      for (const pattern of inputs) {
        const before = await page.evaluate(
          () =>
            (window as unknown as { __asearchBench: Observation })
              .__asearchBench.samples.length,
        );
        await page.locator("#query").fill(pattern);
        await page.waitForFunction(
          (count) =>
            (window as unknown as { __asearchBench: Observation })
              .__asearchBench.samples.length > count,
          before,
        );
      }
    }
    const observed = await page.evaluate(
      () =>
        (window as unknown as { __asearchBench: Observation }).__asearchBench,
    );
    if (observed.errors.length || observed.readyMs === null)
      throw new Error("UI benchmark failed");
    const samples = observed.samples
      .filter((v) => v.pattern)
      .slice(3 * inputs.length);
    if (
      samples.length !== 25 * inputs.length ||
      samples.some(
        (v) =>
          v.domMs < v.roundTripMs ||
          ![v.workerMs, v.roundTripMs, v.domMs].every(
            (n) => Number.isFinite(n) && n >= 0,
          ),
      )
    )
      throw new Error("Missing or invalid UI observations");
    results.push({
      name,
      version: browser.version(),
      readyMs: observed.readyMs,
      warmupRounds: 3,
      inputs,
      samples,
    });
  } finally {
    await browser.close();
  }
}
await writeFile(
  output,
  `${JSON.stringify(
    {
      recordedAtUtc: new Date().toISOString(),
      node: process.version,
      os: platform(),
      cpu: cpus()[0]?.model,
      release: JSON.parse(
        await readFile(
          new URL("../../release.lock.json", import.meta.url),
          "utf8",
        ),
      ),
      artifacts,
      harnessCommit: execFileSync("git", ["rev-parse", "HEAD"], {
        encoding: "utf8",
        cwd: new URL("../../", import.meta.url),
      }).trim(),
      harnessDirty: Boolean(
        execFileSync("git", ["status", "--porcelain"], {
          encoding: "utf8",
          cwd: new URL("../../", import.meta.url),
        }).trim(),
      ),
      observerSha256: sha(
        await readFile(new URL("./observe.ts", import.meta.url)),
      ),
      runnerSha256: createHash("sha256")
        .update(await readFile(new URL(import.meta.url)))
        .digest("hex"),
      scope:
        "Warm Worker public messages including search/explain, response arrival and accepted DOM mutation after the app's rAF; DOM mutation is not paint completion. Startup is one fresh context/navigation per browser, not a cold OS cache. Sequential queries, no network shaping. Experimental pre-release bundles require separate artifact provenance. Not a device guarantee.",
      results,
    },
    null,
    2,
  )}\n`,
);
console.log(
  JSON.stringify(
    results.map(({ name, readyMs, samples }) => ({
      name,
      readyMs,
      samples: samples.length,
    })),
  ),
);
