/** Checks real source excerpts and safe rendering of coherent but hostile metadata. */
import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { open, query } from "./helpers.ts";

test("source excerpts stay separate from original questions and intent results", async ({
  page,
}) => {
  await open(page);
  await query(page, "大学");
  const snippet = page.locator("#results .snippet").first();
  await expect(snippet).toBeVisible();
  expect(Array.from(await snippet.innerText()).length).toBeLessThanOrEqual(160);
  await expect(snippet).toHaveAttribute("aria-label", "元の本文の抜粋");
  await expect(page.locator("#results .question").first()).toBeVisible();
  await page.locator("#mode").selectOption("intent");
  await query(page, "電球交換");
  await expect(page.locator("#results")).toContainText("電球交換");
  await expect(page.locator("#results .snippet")).toHaveCount(0);
});

test("excerpt markup is displayed as text even when the catalog digest is valid", async ({
  page,
  request,
}) => {
  const info = await (await request.get("data/release.json")).json();
  const stage = info.stages[0];
  const rows = await (await request.get(`data/${stage.catalog}`)).json();
  const hostile = '<img src=x onerror="window.snippetExecuted=true">';
  const bytes = JSON.stringify(
    rows.map((row: Record<string, unknown>) => ({ ...row, snippet: hostile })),
  );
  stage.catalogSha256 = createHash("sha256").update(bytes).digest("hex");
  await page.route("**/data/release.json", (route) =>
    route.fulfill({ json: info }),
  );
  await page.route(`**/data/${stage.catalog}`, (route) =>
    route.fulfill({ contentType: "application/json", body: bytes }),
  );
  await open(page);
  await query(page, "大学");
  await expect(page.locator("#results .snippet").first()).toHaveText(hostile);
  await expect(page.locator("#results img")).toHaveCount(0);
  expect(await page.evaluate(() => "snippetExecuted" in window)).toBe(false);
});
