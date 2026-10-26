/** Keeps keyboard navigation usable when facet controls disappear or become disabled. */
import { expect, test } from "@playwright/test";
import { installObservation } from "../tools/bench/observe.ts";
import { open, query, searchAction } from "./helpers.ts";
import { articleCheckbox, openFacets } from "./support/facets.ts";
import { installQueryWorker } from "./support/query-worker.ts";

test("removing an article outside the name filter returns focus to article search", async ({
  page,
}) => {
  await open(page);
  await query(page, "大学");
  await openFacets(page);
  const titles = await page
    .locator("#article-options input")
    .evaluateAll((inputs) =>
      inputs.map((input) => (input as HTMLInputElement).value),
    );
  const first = titles[0],
    second = titles.find(
      (title) =>
        first &&
        !first
          .normalize("NFKC")
          .toLowerCase()
          .includes(title.normalize("NFKC").toLowerCase()),
    );
  if (!first || !second)
    throw new Error("Two distinct article fixtures required");

  const selected = await articleCheckbox(page, first);
  await searchAction(page, () => selected.check());
  await page.locator("#article-search").fill(second);
  await expect(selected).toBeChecked();
  await selected.focus();
  await searchAction(page, () => selected.press("Space"));

  await expect(selected).toHaveCount(0);
  await expect(page.locator("#article-search")).toBeFocused();
  await expect(page.locator("#active-filters")).toBeHidden();
  await expect(page.locator("#filters")).toBeVisible();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Backspace");
  await expect(page.locator("#article-search")).toHaveValue("");
  await expect(page.locator("#article-search")).toBeFocused();
  await expect(selected).toBeVisible();
  await expect(selected).not.toBeChecked();
});

for (const axis of ["article", "update status"] as const) {
  test(`removing the last ${axis} with an empty keyword returns focus to the main search`, async ({
    page,
  }) => {
    await open(page);
    await query(page, "大学");
    await openFacets(page);
    const title = await page
      .locator("#article-options input")
      .first()
      .inputValue();
    const checkbox =
      axis === "article"
        ? await articleCheckbox(page, title)
        : page.locator('#change-options input[value="unchanged"]');
    await searchAction(page, () => checkbox.check());
    await query(page, "");
    await expect(page.locator("#results li")).not.toHaveCount(0);

    await checkbox.focus();
    await searchAction(page, () => checkbox.press("Space"));

    await expect(page.locator("#filters")).toBeHidden();
    await expect(page.locator("#results li")).toHaveCount(0);
    await expect(page.locator("#active-filters")).toBeHidden();
    await expect(page.locator("#query")).toBeFocused();
    await searchAction(page, () => page.keyboard.type("大学"));
    await expect(page.locator("#results li")).toHaveCount(20);
    await expect(page.locator("#filters")).toBeVisible();
    await expect(page.locator("#query")).toBeFocused();
  });
}

test("unchecking a zero-count update state returns focus to article search", async ({
  page,
}) => {
  await open(page);
  await query(page, "更新例");
  await page.locator("#advance").click();
  await expect(page.locator("#results .change-badge")).toHaveCount(4);
  await openFacets(page);
  const checkbox = page.locator('#change-options input[value="added"]');
  await searchAction(page, () => checkbox.check());
  await page.locator("#restore").click();
  await expect(page.locator("#status")).toContainText("世代 1");
  await query(page, "更新例");
  await openFacets(page);
  await expect(checkbox).toBeChecked();
  await expect(checkbox.locator("..")).toContainText("0件");

  await checkbox.focus();
  await searchAction(page, () => checkbox.press("Space"));

  await expect(checkbox).not.toBeChecked();
  await expect(checkbox).toBeDisabled();
  await expect(page.locator("#article-search")).toBeFocused();
  await expect(page.locator("#filters")).toBeVisible();
});

test("hiding facets after a delayed response preserves focus outside the panel", async ({
  page,
}) => {
  await page.addInitScript({
    content: `(${installQueryWorker.toString()})(); (${installObservation.toString()})();`,
  });
  await open(page, { observe: false });
  await query(page, "大学");
  await page.evaluate(() => {
    window.__queryHarness.holdResponses = true;
  });

  await page.locator("#query").fill("");
  await page.waitForFunction(
    () => window.__queryHarness.requests.at(-1)?.request.pattern === "",
  );
  const button = page.getByRole("button", { name: "検索", exact: true });
  await button.focus();
  await page.evaluate(() => window.__queryHarness.reply());

  await expect(page.locator("#filters")).toBeHidden();
  await expect(button).toBeFocused();
});
