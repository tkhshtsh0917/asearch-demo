/** Prevents stale text, unpainted responses and abandoned Workers from satisfying query waits. */
import { expect, test } from "@playwright/test";
import {
  installObservation,
  type Observation,
} from "../tools/bench/observe.ts";
import { open, query } from "./helpers.ts";
import { installQueryWorker } from "./support/query-worker.ts";

test.beforeEach(async ({ page }) => {
  // Keep initialization order explicit; separate addInitScript calls are unordered.
  await page.addInitScript({
    content: `(${installQueryWorker.toString()})(); (${installObservation.toString()})();`,
  });
  await open(page, { observe: false });
  await query(page, "にh");
  await expect(page.locator("#metrics")).toContainText("少なくとも85件一致");
});

test("old metrics cannot complete withheld or identical repeated queries", async ({
  page,
}) => {
  await page.evaluate(() => {
    window.__queryHarness.holdResponses = true;
  });
  await expect(query(page, "に", 350)).rejects.toThrow(/Timeout/);
  await expect(page.locator(".question")).toHaveText("候補:にh");

  await page.evaluate(() => window.__queryHarness.reply());
  await expect(page.locator(".question")).toHaveText("候補:に");
  await expect(query(page, "に", 350)).rejects.toThrow(/Timeout/);
  await page.evaluate(() => {
    window.__queryHarness.holdResponses = false;
  });
  await query(page, "に");
  await expect(page.locator(".question")).toHaveText("候補:に");
});

test("a response and superseded render frame cannot stand in for the latest DOM update", async ({
  page,
}) => {
  await page.evaluate(() => {
    window.__queryHarness.holdPaint = true;
  });
  await expect(query(page, "古い", 350)).rejects.toThrow(/Timeout/);
  expect(await page.evaluate(() => window.__queryHarness.frames)).toBe(1);
  await expect(page.locator(".question")).toHaveText("候補:にh");

  const waiting = expect(query(page, "最新", 700)).rejects.toThrow(/Timeout/);
  await page.waitForFunction(() => window.__queryHarness.frames === 2);
  await page.evaluate(() => window.__queryHarness.paint());
  await waiting;
  await expect(page.locator(".question")).toHaveText("候補:にh");
  await expect(page.locator("#article-options .facet-name")).toHaveText(
    "記事:にh",
  );

  await page.evaluate(() => window.__queryHarness.paint());
  await expect(page.locator(".question")).toHaveText("候補:最新");
  await expect(page.locator("#article-options .facet-name")).toHaveText(
    "記事:最新",
  );
  await page.waitForFunction(() => {
    const observed = (window as unknown as { __asearchBench: Observation })
      .__asearchBench;
    return observed.samples.at(-1)?.sequence === observed.queries;
  });
});

test("a new Worker and a repeated input require their own accepted response", async ({
  page,
}) => {
  const old = await page.evaluate(
    () => window.__queryHarness.requests.length - 1,
  );
  await page.evaluate(() => {
    window.__queryHarness.holdResponses = true;
  });
  await page.locator("#reset").click();
  await expect(page.locator("#status")).toContainText("検索できます");

  const waiting = expect(query(page, "にh", 700)).rejects.toThrow(/Timeout/);
  await page.waitForFunction(
    (index) => window.__queryHarness.requests.length > index + 2,
    old,
  );
  await page.evaluate((index) => window.__queryHarness.reply(index), old);
  await waiting;
  await expect(page.locator("#results li")).toHaveCount(0);

  await page.evaluate(() => {
    window.__queryHarness.holdResponses = false;
  });
  await query(page, "にh");
  await expect(page.locator(".question")).toHaveText("候補:にh");
  await query(page, "");
  await expect(page.locator("#metrics")).toContainText("入力してください");
});
