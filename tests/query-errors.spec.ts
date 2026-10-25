/** Checks query recovery without letting stale responses erase current failures. */
import { expect, type Page, test } from "@playwright/test";
import { installObservation } from "../tools/bench/observe.ts";
import { open, query } from "./helpers.ts";
import { installQueryWorker } from "./support/query-worker.ts";

for (const updated of [false, true]) {
  test(`failed IME queries recover without restart${updated ? " after a delta" : ""}`, async ({
    page,
  }) => {
    await open(page);
    if (updated) {
      await page.locator("#advance").click();
      await expect(page.locator("#status")).toContainText("世代 2");
    }

    await page.locator("#query").evaluate((element) => {
      const input = element as HTMLInputElement;
      input.dispatchEvent(new CompositionEvent("compositionstart"));
      input.value = "あ".repeat(129);
      input.dispatchEvent(
        new InputEvent("input", { bubbles: true, isComposing: true }),
      );
    });
    await expect(page.locator("#error")).toContainText("Invalid query");
    await page.locator("#query").dispatchEvent("compositionend");

    await query(page, "大学");
    await expect(page.locator("#results li")).toHaveCount(20);
    await expect(page.locator("#error")).toBeEmpty();
    await query(page, "");
    await expect(page.locator("#error")).toBeEmpty();
  });
}

/** Waits for a new request while its response is deliberately withheld. */
async function heldQuery(page: Page, pattern: string) {
  const previous = await page.evaluate(
    () => window.__queryHarness.requests.length,
  );
  await page.locator("#query").fill(pattern);
  await page.waitForFunction(
    ({ previous, pattern }) => {
      const requests = window.__queryHarness.requests;
      return (
        requests.length > previous &&
        requests.at(-1)?.request.pattern === pattern
      );
    },
    { previous, pattern },
  );
  return page.evaluate(() => window.__queryHarness.requests.length - 1);
}

/** Settles browser frames without releasing controlled application callbacks. */
async function settled(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

test.describe("controlled query errors", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript({
      content: `(${installQueryWorker.toString()})(); (${installObservation.toString()})();`,
    });
    await open(page, { observe: false });
    await query(page, "最初");
    await page.evaluate(() => {
      window.__queryHarness.holdResponses = true;
    });
  });

  test("superseded responses and queued frames cannot clear a newer failure", async ({
    page,
  }) => {
    await page.evaluate(() => {
      window.__queryHarness.holdPaint = true;
    });
    const old = await heldQuery(page, "古い成功");
    await page.evaluate((index) => window.__queryHarness.reply(index), old);
    await page.waitForFunction(() => window.__queryHarness.frames === 1);

    const failed = await heldQuery(page, "失敗");
    await page.evaluate((index) => window.__queryHarness.fail(index), failed);
    await expect(page.locator("#error")).toContainText("検索失敗");
    await page.evaluate((index) => {
      window.__queryHarness.reply(index);
      window.__queryHarness.paint();
    }, old);
    await settled(page);
    await expect(page.locator("#error")).toContainText("検索失敗");
    await expect(page.locator(".question")).toHaveText("候補:最初");

    const recovered = await heldQuery(page, "回復");
    await page.evaluate(
      (index) => window.__queryHarness.reply(index),
      recovered,
    );
    await page.waitForFunction(() => window.__queryHarness.frames === 1);
    await expect(page.locator("#error")).toContainText("検索失敗");
    await page.evaluate(() => window.__queryHarness.paint());
    await expect(page.locator(".question")).toHaveText("候補:回復");
    await expect(page.locator("#error")).toBeEmpty();
  });

  test("abandoned Workers and different epochs cannot resolve or replace a current failure", async ({
    page,
  }) => {
    const abandoned = await page.evaluate(
      () => window.__queryHarness.requests.length - 1,
    );
    await page.locator("#reset").click();
    await expect(page.locator("#status")).toContainText("検索できます");
    const current = await heldQuery(page, "現在の失敗");
    await page.evaluate((index) => window.__queryHarness.fail(index), current);
    await expect(page.locator("#error")).toContainText("検索失敗");

    await page.evaluate(
      ({ abandoned, current }) => {
        window.__queryHarness.reply(abandoned);
        window.__queryHarness.fail(abandoned, "旧Workerの失敗");
        window.__queryHarness.reply(current, 1);
        window.__queryHarness.fail(current, "別の世代の失敗", 1);
      },
      { abandoned, current },
    );
    await settled(page);
    await expect(page.locator("#results li")).toHaveCount(0);
    await expect(page.locator("#error")).toHaveText(
      "処理できませんでした: 検索失敗",
    );

    await page.evaluate(() => {
      window.__queryHarness.holdResponses = false;
    });
    await query(page, "正常");
    await expect(page.locator("#error")).toBeEmpty();
    await page.evaluate((index) => window.__queryHarness.fail(index), current);
    await settled(page);
    await expect(page.locator("#error")).toBeEmpty();
  });

  test("query recovery preserves publication errors", async ({ page }) => {
    await page.evaluate(() =>
      window.__queryHarness.operationError("更新に失敗"),
    );
    const failed = await heldQuery(page, "検索の失敗");
    await page.evaluate((index) => window.__queryHarness.fail(index), failed);
    await expect(page.locator("#error")).toContainText("更新に失敗");
    await expect(page.locator("#error")).toContainText("検索失敗");

    await page.evaluate(() => {
      window.__queryHarness.holdResponses = false;
    });
    await query(page, "正常");
    await expect(page.locator("#error")).toHaveText(
      "処理できませんでした: 更新に失敗",
    );
  });
});
