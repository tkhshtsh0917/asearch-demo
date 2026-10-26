/** Checks focus before disabling facet controls and preserves selections through Worker recovery. */
import { expect, type Page, test } from "@playwright/test";
import { open, query } from "./helpers.ts";
import { settleFrames } from "./support/controlled-search.ts";
import { selectArticle } from "./support/facets.ts";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(...args: ConstructorParameters<typeof Worker>) {
        super(...args);
        Object.assign(window, { __focusWorker: this });
      }
    };
  });
  await open(page);
  await query(page, "大学");
  const title = await page
    .locator("#results li")
    .first()
    .getAttribute("data-article");
  if (!title) throw new Error("Article fixture required");
  await selectArticle(page, title);
});

/** Runs the real Worker error handler and waits past browser-managed focus changes. */
async function stopWorker(page: Page) {
  await page.evaluate(() => {
    const worker = (window as unknown as { __focusWorker: Worker })
      .__focusWorker;
    worker.dispatchEvent(
      new ErrorEvent("error", { message: "Injected failure" }),
    );
  });
  await expect(page.locator("#status")).toContainText("検索を停止しました");
  await settleFrames(page);
}

for (const [name, selector] of [
  ["article search", "#article-search"],
  ["clear filters", "#filters-clear"],
  ["article checkbox", "#article-options input:checked"],
  ["update checkbox", '#change-options input[value="unchanged"]'],
  ["chip", "#active-filters button"],
] as const) {
  test(`disabling ${name} moves focus to the main query and restart restores the selection`, async ({
    page,
  }) => {
    const title = await page
      .locator("#article-options input:checked")
      .inputValue();
    await page.locator(selector).focus();

    await stopWorker(page);

    await expect(page.locator("#query")).toBeFocused();
    await expect(page.locator("#article-search")).toBeDisabled();
    await expect(page.locator("#filters-clear")).toBeDisabled();
    await expect(page.locator("#article-options input:checked")).toBeDisabled();
    await expect(page.locator("#active-filters button")).toBeDisabled();
    await expect(page.locator("#filters-toggle")).toBeEnabled();

    const reset = page.locator("#reset");
    await reset.focus();
    await reset.press("Enter");
    await expect(page.locator("#status")).toContainText("検索できます");
    await query(page, "大学");
    await expect(page.locator("#error")).toBeEmpty();
    await expect(page.locator("#article-options input:checked")).toHaveValue(
      title,
    );
    await expect(page.locator("#article-options input:checked")).toBeEnabled();
    await expect(page.locator("#active-filters button")).toBeEnabled();
    expect(await page.locator("#results li").count()).toBeGreaterThan(0);
    expect(
      await page
        .locator("#results li")
        .evaluateAll(
          (rows, title) =>
            rows.every((row) => (row as HTMLElement).dataset.article === title),
          title,
        ),
    ).toBe(true);
    await expect(reset).toBeFocused();
  });
}

for (const [name, selector] of [
  ["main query", "#query"],
  ["restart", "#reset"],
  ["toggle", "#filters-toggle"],
] as const) {
  test(`Worker failure preserves enabled ${name} focus`, async ({ page }) => {
    const target = page.locator(selector);
    await target.focus();

    await stopWorker(page);

    await expect(target).toBeEnabled();
    await expect(target).toBeFocused();
    await page.setViewportSize({ width: 801, height: 900 });
    if (name === "toggle") {
      await expect(target).toBeHidden();
      await expect(page.locator("#query")).toBeFocused();
    } else await expect(target).toBeFocused();
  });
}
