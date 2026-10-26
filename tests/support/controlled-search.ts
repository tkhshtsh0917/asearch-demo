/** Coordinates withheld Worker responses with the real UI and accepted DOM observations. */
import type { Page } from "@playwright/test";
import type { Facets } from "../../src/shared/facets.ts";
import {
  installObservation,
  type Observation,
} from "../../tools/bench/observe.ts";
import { open, query } from "../helpers.ts";
import { installQueryWorker } from "./query-worker.ts";

export async function openControlledSearch(page: Page, pattern = "大学") {
  await page.addInitScript({
    content: `(${installQueryWorker.toString()})(); (${installObservation.toString()})();`,
  });
  await open(page, { observe: false });
  await query(page, pattern);
}

/** Captures the new request caused by an action; callers control response withholding. */
export async function captureRequest(
  page: Page,
  action: () => Promise<unknown>,
) {
  const before = await page.evaluate(
    () => window.__queryHarness.requests.length,
  );
  await action();
  await page.waitForFunction(
    (before) => window.__queryHarness.requests.length > before,
    before,
  );
  return page.evaluate(() => window.__queryHarness.requests.length - 1);
}

/** Requires the latest accepted DOM render, including repeated input with identical text. */
export async function releaseResult(
  page: Page,
  index?: number,
  facets?: Facets,
) {
  await page.evaluate(
    ({ index, facets }) => window.__queryHarness.reply(index, 0, facets),
    { index, facets },
  );
  await page.waitForFunction(() => {
    const observed = (window as unknown as { __asearchBench: Observation })
      .__asearchBench;
    return observed.samples.at(-1)?.sequence === observed.queries;
  });
}

export async function settleFrames(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}
