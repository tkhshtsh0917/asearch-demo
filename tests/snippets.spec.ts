/** Checks real source excerpts and safe rendering of coherent but hostile metadata. */
import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { open, query, searchAction } from "./helpers.ts";
import { openFacets } from "./support/facets.ts";

test("source excerpts stay separate from original questions", async ({
  page,
}) => {
  await open(page);
  await query(page, "大学");
  const snippet = page.locator("#results .snippet-text").first();
  await expect(snippet).toBeVisible();
  const text = await snippet.textContent();
  expect(text).toBeTruthy();
  expect(Array.from(text ?? "").length).toBeLessThanOrEqual(160);
  await expect(page.locator("#results .snippet-label").first()).toHaveText(
    "本文抜粋",
  );
  await expect(page.locator("#results .question").first()).toBeVisible();
});

test("catalog markup stays text in excerpts, facets and selection chips", async ({
  page,
  request,
}) => {
  const info = await (await request.get("data/release.json")).json();
  const stage = info.stages[0];
  const rows = await (await request.get(`data/${stage.catalog}`)).json();
  const hostile = '<img src=x onerror="window.snippetExecuted=true">';
  const bytes = JSON.stringify(
    rows.map((row: Record<string, unknown>) => ({
      ...row,
      title: hostile,
      snippet: hostile,
    })),
  );
  stage.catalogSha256 = createHash("sha256").update(bytes).digest("hex");
  stage.catalog = `catalog.${stage.catalogSha256.slice(0, 20)}.json`;
  await page.route("**/data/release.json", (route) =>
    route.fulfill({ json: info }),
  );
  await page.route(`**/data/${stage.catalog}`, (route) =>
    route.fulfill({ contentType: "application/json", body: bytes }),
  );
  await open(page);
  await query(page, "大学");
  await expect(page.locator("#results .snippet-text").first()).toHaveText(
    hostile,
  );
  await openFacets(page);
  await expect(page.locator("#article-options .facet-name")).toHaveText(
    hostile,
  );
  await searchAction(page, () =>
    page.locator("#article-options input").check(),
  );
  await expect(page.locator("#active-filters button")).toContainText(hostile);
  await expect(
    page.locator("#results img, #filters img, #active-filters img"),
  ).toHaveCount(0);
  expect(await page.evaluate(() => "snippetExecuted" in window)).toBe(false);
});
