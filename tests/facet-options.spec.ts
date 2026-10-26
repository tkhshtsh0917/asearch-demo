/** Preserves checkbox activation across responses and count-driven option reordering. */
import { expect, test } from "@playwright/test";
import { searchAction } from "./helpers.ts";
import {
  captureRequest,
  openControlledSearch,
  releaseResult,
} from "./support/controlled-search.ts";
import { openFacets } from "./support/facets.ts";

test.beforeEach(async ({ page }) => {
  await openControlledSearch(page);
  await openFacets(page);
});

for (const [axis, selector] of [
  ["article", "#article-options input"],
  ["update status", '#change-options input[value="unchanged"]'],
] as const) {
  test(`responses during Space preserve ${axis} checkbox selection and deselection`, async ({
    page,
  }) => {
    const checkbox = page.locator(selector),
      original = await checkbox.elementHandle();
    if (!original) throw new Error("Checkbox required");
    await checkbox.focus();

    for (const checked of [true, false]) {
      await page.evaluate(() => {
        window.__queryHarness.holdResponses = true;
      });
      await page.keyboard.down("Space");
      const index = await captureRequest(page, () =>
        page.locator("#query").dispatchEvent("input"),
      );
      await releaseResult(page, index);

      expect(await original.evaluate((input) => input.isConnected)).toBe(true);
      await expect(checkbox).toBeFocused();
      await page.evaluate(() => {
        window.__queryHarness.holdResponses = false;
      });
      await searchAction(page, () => page.keyboard.up("Space"));
      await expect(checkbox).toBeChecked({ checked });
      await expect(checkbox).toBeFocused();
      await expect(page.locator("#active-filters button")).toHaveCount(
        checked ? 1 : 0,
      );
    }
  });
}

test("changing counts reorders options without moving the focused checkbox node", async ({
  page,
}) => {
  await page.evaluate(() => {
    window.__queryHarness.holdResponses = true;
  });
  const first = "記事:大学",
    second = "別の記事";
  const changes = [{ kind: "unchanged" as const, count: 85 }];
  let index = await captureRequest(page, () =>
    page.locator("#query").dispatchEvent("input"),
  );
  await releaseResult(page, index, {
    articles: [
      { title: first, count: 60 },
      { title: second, count: 25 },
    ],
    changes,
  });
  const checkbox = page.locator("#article-options input").first(),
    original = await checkbox.elementHandle();
  if (!original) throw new Error("Checkbox required");
  await checkbox.focus();
  await page.keyboard.down("Space");

  index = await captureRequest(page, () =>
    page.locator("#query").dispatchEvent("input"),
  );
  await releaseResult(page, index, {
    articles: [
      { title: second, count: 60 },
      { title: first, count: 25 },
    ],
    changes,
  });
  expect(await original.evaluate((input) => input.isConnected)).toBe(true);
  const retained = page.locator("#article-options input");
  await expect(retained.nth(1)).toHaveValue(first);
  await expect(retained.nth(1)).toBeFocused();
  await page.evaluate(() => {
    window.__queryHarness.holdResponses = false;
  });
  await searchAction(page, () => page.keyboard.up("Space"));
  await expect(page.locator("#article-options input:checked")).toHaveValue(
    first,
  );
  await expect(page.locator("#active-filters button")).toHaveCount(1);
});

test("all four-option permutations preserve order, focused identity and connectivity", async ({
  page,
}) => {
  const checks = await page.evaluate(async () => {
    const titles = ["記事A", "記事B", "記事C", "記事D"];
    function permutations(values: string[]): string[][] {
      if (values.length === 0) return [[]];
      return values.flatMap((value, index) =>
        permutations(values.filter((_, other) => other !== index)).map(
          (rest) => [value, ...rest],
        ),
      );
    }
    async function render(order: string[]) {
      document
        .getElementById("query")
        ?.dispatchEvent(new Event("input", { bubbles: true }));
      await Promise.resolve();
      window.__queryHarness.reply(undefined, 0, {
        articles: order.map((title, index) => ({
          title,
          count: index === 0 ? 22 : 21,
        })),
        changes: [{ kind: "unchanged", count: 85 }],
      });
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
    }
    window.__queryHarness.holdResponses = true;
    await render(titles);
    let checked = 0;
    for (const focused of titles) {
      for (const order of permutations(titles)) {
        const original = Array.from(
          document.querySelectorAll<HTMLInputElement>("#article-options input"),
        ).find((input) => input.value === focused);
        if (!original) throw new Error("Missing checkbox");
        original.focus();
        await render(order);
        const values = Array.from(
          document.querySelectorAll<HTMLInputElement>("#article-options input"),
        ).map((input) => input.value);
        if (
          values.join() !== order.join() ||
          !original.isConnected ||
          document.activeElement !== original
        )
          throw new Error(
            `Lost order or focus for ${focused}: ${order.join()}`,
          );
        checked++;
      }
    }
    return checked;
  });
  expect(checks).toBe(96);
});
