/** Preserves selection-button identity and keyboard activation across accepted query renders. */
import { expect, test } from "@playwright/test";
import { searchAction } from "./helpers.ts";
import {
  captureRequest,
  openControlledSearch,
  releaseResult,
  settleFrames,
} from "./support/controlled-search.ts";
import { openFacets, selectArticle } from "./support/facets.ts";

test.beforeEach(async ({ page }) => {
  await openControlledSearch(page);
});

for (const axis of ["article", "update status"] as const) {
  test(`an accepted response during Space activation preserves the ${axis} chip and removes it once`, async ({
    page,
  }) => {
    if (axis === "article") await selectArticle(page, "記事:大学");
    else {
      await openFacets(page);
      await searchAction(page, () =>
        page.locator('#change-options input[value="unchanged"]').check(),
      );
    }
    const chip = page.locator("#active-filters button"),
      original = await chip.elementHandle();
    if (!original) throw new Error("Selection chip required");
    await chip.focus();
    await page.evaluate(() => {
      window.__queryHarness.holdResponses = true;
    });

    await page.keyboard.down("Space");
    const index = await captureRequest(page, () =>
      page.locator("#query").dispatchEvent("input"),
    );
    await releaseResult(page, index);

    expect(await original.evaluate((button) => button.isConnected)).toBe(true);
    await expect(chip).toBeFocused();
    await page.evaluate(() => {
      window.__queryHarness.holdResponses = false;
    });
    await searchAction(page, () => page.keyboard.up("Space"));
    await expect(page.locator("#active-filters")).toBeHidden();
    await expect(page.locator("#query")).toBeFocused();
  });
}

test("stale and current responses preserve the same focused zero-count selection chip", async ({
  page,
}) => {
  await selectArticle(page, "記事:大学");
  await page.evaluate(() => {
    window.__queryHarness.holdResponses = true;
  });
  const old = await captureRequest(page, () =>
    page.locator("#query").fill("古い"),
  );
  const latest = await captureRequest(page, () =>
    page.locator("#query").fill("最新"),
  );
  const chip = page.locator("#active-filters button"),
    original = await chip.elementHandle();
  if (!original) throw new Error("Selection chip required");
  await chip.focus();

  await page.evaluate((index) => window.__queryHarness.reply(index), old);
  await settleFrames(page);
  await expect(page.locator(".question")).toHaveText("候補:大学");
  await expect(chip).toBeFocused();

  await releaseResult(page, latest);
  expect(await original.evaluate((button) => button.isConnected)).toBe(true);
  await expect(chip).toBeFocused();
  await expect(
    page.locator("#article-options input:checked").locator(".."),
  ).toContainText("0件");
});
