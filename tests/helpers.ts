/** Shared readiness and input helpers that wait for a new accepted search render. */
import { expect, type Page } from "@playwright/test";
import {
  installObservation,
  type Observation,
} from "../tools/bench/observe.ts";

export async function open(page: Page, options: { observe?: boolean } = {}) {
  if (options.observe !== false) await page.addInitScript(installObservation);
  await page.goto("./");
  await expect(page.locator("#status")).toContainText("検索できます");
}

/** Requires a response and DOM mutation for this input, including identical repeated text. */
export async function query(page: Page, text: string, timeout?: number) {
  const before = await page.evaluate(
    () =>
      (window as unknown as { __asearchBench: Observation }).__asearchBench
        .queries,
  );
  const input = page.locator("#query");
  if ((await input.inputValue()) === text) await input.dispatchEvent("input");
  else await input.fill(text);

  await page.waitForFunction(
    ({ before, text }) => {
      const observed = (window as unknown as { __asearchBench: Observation })
        .__asearchBench;
      const sample = observed.samples.at(-1);
      return (
        sample !== undefined &&
        sample.sequence > before &&
        sample.sequence === observed.queries &&
        sample.pattern === text
      );
    },
    { before, text },
    timeout === undefined ? {} : { timeout },
  );
}
