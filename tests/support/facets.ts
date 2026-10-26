/** Operates the same native facet controls in desktop and mobile layouts. */
import { expect, type Page } from "@playwright/test";
import { searchAction } from "../helpers.ts";

export async function openFacets(page: Page) {
  const toggle = page.locator("#filters-toggle");
  const narrow = await page.evaluate(
    () => matchMedia("(max-width: 800px)").matches,
  );
  if (narrow) {
    await expect(toggle).toBeVisible();
    if ((await toggle.getAttribute("aria-expanded")) !== "true")
      await toggle.click();
  } else await expect(toggle).toBeHidden();
  await expect(page.locator("#facet-body")).toBeVisible();
}

export async function articleCheckbox(page: Page, title: string) {
  await openFacets(page);
  await page.locator("#article-search").fill(title);
  return page
    .locator("#article-options label")
    .filter({ has: page.getByText(title || "記事名なし", { exact: true }) })
    .getByRole("checkbox");
}

export async function selectArticle(page: Page, title: string) {
  const checkbox = await articleCheckbox(page, title);
  await searchAction(page, () => checkbox.check());
  await expect(checkbox).toBeChecked();
}
