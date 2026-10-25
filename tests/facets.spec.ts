/** Verifies article filtering before top-N and selection across publication transitions. */
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { open, query } from "./helpers.ts";

test("article search reaches candidates outside global top-20 and clearing restores results", async ({
  page,
  request,
}, testInfo) => {
  await open(page);
  await query(page, "大学");
  await expect(page.locator("#results li")).toHaveCount(20);
  const displayed = await page
    .locator("#results li")
    .evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLElement).dataset.article),
    );
  const info = await (await request.get("data/release.json")).json();
  const rows = (await (
    await request.get(`data/${info.stages[0].catalog}`)
  ).json()) as { text: string; title: string }[];
  const target = rows.find(
    (row) => row.text.includes("大学") && !displayed.includes(row.title),
  );
  expect(target).toBeTruthy();
  if (!target) throw new Error("No out-of-top-20 article fixture");

  await page.locator(".article-filter > summary").click();
  await expect(page.locator("#article-summary")).toContainText("収録質問数");
  expect(await page.locator("#article option").count()).toBeLessThanOrEqual(52);
  await page.locator("#article-search").fill(target.title);
  await page.locator("#article").selectOption(JSON.stringify(target.title));
  await page.waitForFunction((title) => {
    const rows = Array.from(
      document.querySelectorAll<HTMLElement>("#results li"),
    );
    return (
      rows.length > 0 && rows.every((row) => row.dataset.article === title)
    );
  }, target.title);
  await expect(page.locator("#metrics")).not.toContainText("少なくとも");
  if (["chromium", "iphone-profile"].includes(testInfo.project.name)) {
    const report = await new AxeBuilder({ page }).analyze();
    expect(
      report.violations.filter((item) =>
        ["serious", "critical"].includes(item.impact ?? ""),
      ),
    ).toEqual([]);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator("#article-clear").click();
  await expect(page.locator("#article")).toHaveValue("");
  await expect(page.locator("#results li")).toHaveCount(20);
});

test("article-only browsing preserves a zero-count selection through restore and restart", async ({
  page,
}) => {
  await open(page);
  await page.locator("#advance").click();
  await expect(page.locator("#status")).toContainText("世代 2");
  await page.locator(".article-filter > summary").click();
  const title = "デモ用の合成質問";
  await page.locator("#article-search").fill(title);
  await page.locator("#article").selectOption(JSON.stringify(title));
  await expect(page.locator("#query")).toHaveValue("");
  await expect(page.locator("#results li")).toHaveCount(1);
  await expect(page.locator("#metrics")).toContainText("1件一致");
  await page.locator("#advance").click();
  await expect(page.locator("#status")).toContainText("世代 3");
  await expect(page.locator("#results li")).toHaveCount(1);
  await page.locator("#restore").click();
  await expect(page.locator("#status")).toContainText("世代 1");
  await expect(page.locator("#results li")).toHaveCount(0);
  await expect(page.locator("#article")).toHaveValue(JSON.stringify(title));
  await expect(page.locator("#article option:checked")).toContainText("0件");
  await page.locator("#advance").click();
  await expect(page.locator("#results [data-change='added']")).toHaveCount(1);
  await page.locator("#reset").click();
  await expect(page.locator("#status")).toContainText("世代 1");
  await expect(page.locator("#results li")).toHaveCount(0);
  await expect(page.locator("#article")).toHaveValue(JSON.stringify(title));
});

test("query examples clear an existing article filter", async ({ page }) => {
  await open(page);
  await page.locator(".article-filter > summary").click();
  await page.locator("#article-search").fill("アンパサンド");
  await page.locator("#article").selectOption(JSON.stringify("アンパサンド"));
  await expect(page.locator("#results .question").first()).toBeVisible();
  await page.locator('[data-query="Beatles"]').click();
  await expect(page.locator("#article")).toBeEnabled();
  await expect(page.locator("#article")).toHaveValue("");
  await expect(page.locator("#results")).toContainText("ビートルズ");
});
