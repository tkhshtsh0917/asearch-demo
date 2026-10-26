/** Checks focus ownership and disclosure state across collapse, resize and delayed renders. */
import { expect, test } from "@playwright/test";
import { open, query } from "./helpers.ts";
import {
  captureRequest,
  openControlledSearch,
  releaseResult,
} from "./support/controlled-search.ts";
import { openFacets, selectArticle } from "./support/facets.ts";

test("closing content returns focus to the toggle for clicks and touch", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await open(page);
  await query(page, "大学");
  await openFacets(page);
  const toggle = page.locator("#filters-toggle"),
    body = page.locator("#facet-body");
  const questions = await page.locator("#results .question").allTextContents();

  await page.locator("#article-search").focus();
  await toggle.click();
  await expect(body).toBeHidden();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();

  if (testInfo.project.use.hasTouch) {
    await toggle.press("Space");
    await expect(body).toBeVisible();
    await page.locator("#article-search").focus();
    await toggle.tap();
    await expect(body).toBeHidden();
    await expect(toggle).toBeFocused();
  }

  await toggle.press("Space");
  await expect(body).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#results .question")).toHaveText(questions);
});

test("crossing the closed mobile boundary moves focus before hiding content or toggle", async ({
  page,
}) => {
  await page.setViewportSize({ width: 801, height: 900 });
  await open(page);
  await query(page, "大学");
  const toggle = page.locator("#filters-toggle"),
    body = page.locator("#facet-body");
  await page.locator("#article-options input").first().focus();

  await page.setViewportSize({ width: 800, height: 900 });
  await expect(body).toBeHidden();
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();

  await page.setViewportSize({ width: 801, height: 900 });
  await expect(body).toBeVisible();
  await expect(toggle).toBeHidden();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#article-search")).toBeFocused();
});

for (const owner of ["query", "chip"] as const) {
  test(`responsive changes preserve ${owner} focus outside the panel`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 801, height: 900 });
    await open(page);
    await query(page, "大学");
    if (owner === "chip") {
      const title = await page
        .locator("#article-options input")
        .first()
        .inputValue();
      await selectArticle(page, title);
    }
    const outside = page.locator(
      owner === "query" ? "#query" : "#active-filters button",
    );
    await outside.focus();

    await page.setViewportSize({ width: 800, height: 900 });
    await expect(page.locator("#facet-body")).toBeHidden();
    await expect(outside).toBeFocused();
    await page.setViewportSize({ width: 801, height: 900 });
    await expect(page.locator("#facet-body")).toBeVisible();
    await expect(outside).toBeFocused();
  });
}

test("an open mobile preference survives desktop round trips without moving content focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await open(page);
  await query(page, "大学");
  await openFacets(page);
  await page.setViewportSize({ width: 801, height: 900 });
  await expect(page.locator("#filters-toggle")).toBeHidden();
  const option = page.locator("#article-options input").first();
  await option.focus();

  await page.setViewportSize({ width: 800, height: 900 });
  await expect(page.locator("#facet-body")).toBeVisible();
  await expect(page.locator("#filters-toggle")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(option).toBeFocused();
});

test("an accepted response keeps collapsed content hidden and does not take toggle focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await openControlledSearch(page);
  await openFacets(page);
  await page.evaluate(() => {
    window.__queryHarness.holdResponses = true;
  });
  const index = await captureRequest(page, () =>
    page.locator("#query").dispatchEvent("input"),
  );
  await page.locator("#article-search").focus();
  const toggle = page.locator("#filters-toggle");
  await toggle.click();

  await page.keyboard.down("Space");
  await releaseResult(page, index);
  await expect(page.locator("#facet-body")).toBeHidden();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();
  await page.keyboard.up("Space");
  await expect(page.locator("#facet-body")).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
});
