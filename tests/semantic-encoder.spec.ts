/** Checks inference message-decoding failure through the real semantic coordinator. */
import { expect, test } from "@playwright/test";
import {
  requireSemanticAssets,
  semanticQuery,
  semanticReady,
  semanticWorkerAsset,
} from "./support/semantic.ts";

requireSemanticAssets();

/** Drops the first inference reply and delivers the native messageerror event instead. */
function failFirstInference() {
  const Native = globalThis.Worker;
  let attempts = 0;
  globalThis.Worker = class extends Native {
    constructor(...args: ConstructorParameters<typeof Worker>) {
      super(...args);
      if (String(args[0]).includes("/encoder-") && ++attempts === 1)
        this.postMessage = () => {
          queueMicrotask(() =>
            this.dispatchEvent(new MessageEvent("messageerror")),
          );
        };
    }
  };
}

test("inference messageerror reports promptly and a fresh encoder completes the next query", async ({
  page,
}) => {
  test.setTimeout(180000);
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  await page.route(`**/assets/${semanticWorkerAsset()}`, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: `(${failFirstInference.toString()})();\n${await response.text()}`,
    });
  });
  await semanticReady(page);
  await page.locator("#query").fill("日本");
  await expect(page.locator("#results li").first()).toBeVisible();

  await page.locator("#semantic-enable").click();
  await expect(page.locator("#semantic-status")).toContainText(
    "Encoder response could not be decoded",
    { timeout: 10000 },
  );
  await expect(page.locator("#semantic-results li")).toHaveCount(0);
  await expect(page.locator("#results li").first()).toBeVisible();

  await semanticQuery(page);
  await expect(page.locator("#semantic-results li")).toHaveCount(5);
  await expect(page.locator("#results li").first()).toBeVisible();
  expect(failures).toEqual([]);
});
