// Run both explicit WASM distributions in independent browser module scopes.
import { resolve } from "node:path";
import { chromium, firefox, webkit } from "@playwright/test";
import { startServer } from "./start-server.mjs";

export async function compareBrowserSessions(
  baselineDist,
  candidateDist,
  indexPath,
  expectedSha,
  engine,
  measurement = {},
) {
  const server = await startServer({
    indexPath: resolve(indexPath),
    distributions: {
      baseline: resolve(baselineDist),
      candidate: resolve(candidateDist),
    },
  });
  const results = [];
  try {
    for (const [name, type] of Object.entries({ chromium, firefox, webkit })) {
      const browser = await type.launch();
      try {
        const page = await browser.newPage();
        await page.goto(server.url);
        const result = await page.evaluate(
          async ({ expectedSha, engine, measurement }) => {
            const baseline = await import("/__dist/baseline/web.mjs");
            const candidate = await import("/__dist/candidate/web.mjs");
            await baseline.init();
            await candidate.init();
            const { measureComparison } = await import(
              "/tools/bench/operation-measure.mjs"
            );
            const response = await fetch("/fixture.asix");
            if (!response.ok) throw new Error("Fixture unavailable");
            const bytes = new Uint8Array(await response.arrayBuffer());
            const digest = new Uint8Array(
              await crypto.subtle.digest("SHA-256", bytes),
            );
            const actualSha = [...digest]
              .map((v) => v.toString(16).padStart(2, "0"))
              .join("");
            if (actualSha !== expectedSha)
              throw new Error("Fixture digest mismatch");
            return measureComparison(baseline, bytes, {
              ...measurement,
              candidateApi: candidate,
              baselineEngine: engine,
              candidateEngine: engine,
            });
          },
          { expectedSha, engine, measurement },
        );
        results.push({ name, version: browser.version(), ...result });
      } finally {
        await browser.close();
      }
    }
  } finally {
    await server.close();
  }
  return results;
}
