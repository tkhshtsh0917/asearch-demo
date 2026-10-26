/** Checks sidebar drill-down, disjunctive counts, selection lifetime and responsive access. */
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { open, query, searchAction } from "./helpers.ts";
import {
  articleCheckbox,
  openFacets,
  selectArticle,
} from "./support/facets.ts";

test("facets appear only on the results screen and stay on the left on desktop", async ({
  page,
}, testInfo) => {
  await open(page);
  await expect(page.locator("#filters")).toBeHidden();
  await query(page, "大学");
  await expect(page.locator("#filters")).toBeVisible();
  await openFacets(page);
  await expect(page.getByRole("group", { name: "出典記事" })).toBeVisible();
  await expect(page.getByRole("group", { name: "更新状態" })).toBeVisible();
  if (!testInfo.project.name.includes("profile")) {
    const side = await page.locator("#filters").boundingBox(),
      results = await page.locator(".results-pane").boundingBox();
    expect(side && results && side.x + side.width <= results.x).toBeTruthy();
  }
  await query(page, "");
  await expect(page.locator("#filters")).toBeHidden();
  await expect(page.locator("#results li")).toHaveCount(0);
  await expect(page.locator("#query")).toBeFocused();
});

test("article drill-down reaches candidates beyond top-20 and counts only matching questions", async ({
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
  if (!target) throw new Error("No out-of-top-20 article fixture");
  await selectArticle(page, target.title);
  await page.waitForFunction((title) => {
    const rows = Array.from(
      document.querySelectorAll<HTMLElement>("#results li"),
    );
    return (
      rows.length > 0 && rows.every((row) => row.dataset.article === title)
    );
  }, target.title);
  await expect(page.locator("#metrics")).not.toContainText("少なくとも");
  await expect(page.locator("#article-summary")).toContainText(
    "キーワードと更新状態",
  );
  expect(
    await page.locator("#article-options input").count(),
  ).toBeLessThanOrEqual(100);
  if (["chromium", "iphone-profile"].includes(testInfo.project.name)) {
    const report = await new AxeBuilder({ page }).analyze();
    expect(
      report.violations.filter((item) =>
        ["serious", "critical"].includes(item.impact ?? ""),
      ),
    ).toEqual([]);
  }
  await searchAction(page, () => page.locator("#filters-clear").click());
  await expect(page.locator("#results li")).toHaveCount(20);
  await expect(page.locator("#active-filters")).toBeHidden();
});

test("multiple articles form a union and a chip removes just one choice", async ({
  page,
}) => {
  await open(page);
  await query(page, "大学");
  await openFacets(page);
  const options = await page
    .locator("#article-options label")
    .evaluateAll((labels) =>
      labels.map((label) => ({
        title: label.querySelector("input")?.value ?? "",
        count: Number(
          label
            .querySelector(".facet-count")
            ?.textContent?.replace(/[^0-9]/g, ""),
        ),
      })),
    );
  const [left, right] = options.slice(-2);
  if (!left || !right || left.title === right.title)
    throw new Error("Two article fixtures required");
  const first = left.title,
    second = right.title;
  await selectArticle(page, first);
  await selectArticle(page, second);
  await page.waitForFunction(
    (titles) => {
      const rows = [...document.querySelectorAll<HTMLElement>("#results li")];
      return (
        rows.length > 0 &&
        rows.every((row) => titles.includes(row.dataset.article ?? ""))
      );
    },
    [first, second],
  );
  await expect(page.locator("#metrics")).toHaveText(
    new RegExp(`^${(left.count + right.count).toLocaleString("en-US")}件一致`),
  );
  await expect(page.locator("#active-filters button")).toHaveCount(2);
  await searchAction(page, () =>
    page
      .getByRole("button", {
        name: `記事：${first}の絞り込みを解除`,
        exact: true,
      })
      .click(),
  );
  await expect(page.locator("#metrics")).toHaveText(
    new RegExp(`^${right.count.toLocaleString("en-US")}件一致`),
  );
  await expect(page.locator("#results li")).toHaveCount(
    Math.min(20, right.count),
  );
  expect(
    await page
      .locator("#results li")
      .evaluateAll((rows) => [
        ...new Set(rows.map((row) => (row as HTMLElement).dataset.article)),
      ]),
  ).toEqual([second]);
  await expect(page.locator("#active-filters button")).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("article and update filters combine and remain selected at zero through restore", async ({
  page,
}) => {
  await open(page);
  await query(page, "更新例");
  await expect(page.locator("#results li")).toHaveCount(0);
  await page.locator("#advance").click();
  await expect(page.locator("#results .change-badge")).toHaveCount(4);
  await openFacets(page);
  const added = page
    .locator("#change-options")
    .getByRole("checkbox", { name: /^追加された質問\s*（1件）$/ });
  await searchAction(page, () => added.check());
  await expect(page.locator("#results [data-change='added']")).toHaveCount(1);
  await expect(page.locator("#results li")).toHaveCount(1);
  const title = "デモ用の合成質問";
  await selectArticle(page, title);
  await expect(page.locator("#active-filters button")).toHaveCount(2);
  await query(page, "");
  await expect(page.locator("#results li")).toHaveCount(1);
  await page.locator("#advance").click();
  await expect(page.locator("#status")).toContainText("世代 3");
  await expect(page.locator("#results li")).toHaveCount(1);
  await page.locator("#restore").click();
  await expect(page.locator("#status")).toContainText("世代 1");
  await expect(page.locator("#results li")).toHaveCount(0);
  const retained = await articleCheckbox(page, title);
  await expect(retained).toBeChecked();
  await expect(retained).toBeEnabled();
  await expect(retained.locator("..")).toContainText("0件");
  await expect(
    page.locator("#change-options input[value='added']"),
  ).toBeChecked();
  await page.locator("#reset").click();
  await expect(page.locator("#status")).toContainText("検索できます");
  await expect(page.locator("#results li")).toHaveCount(0);
  await openFacets(page);
  await expect(
    page.locator("#change-options input[value='added']"),
  ).toBeChecked();
  await page.locator("#advance").click();
  await expect(page.locator("#results [data-change='added']")).toHaveCount(1);
});

test("native checkbox focus survives count updates and examples clear all filters", async ({
  page,
}) => {
  await open(page);
  await query(page, "大学");
  const title = await page
    .locator("#results li")
    .first()
    .getAttribute("data-article");
  if (!title) throw new Error("Article fixture missing");
  const checkbox = await articleCheckbox(page, title);
  await checkbox.focus();
  await searchAction(page, () => checkbox.press("Space"));
  await expect(checkbox).toBeChecked();
  await expect(checkbox).toBeFocused();
  await page.locator('[data-query="Beatles"]').click();
  await expect(page.locator("#active-filters")).toBeHidden();
  await expect(page.locator("#results")).toContainText("ビートルズ");
});
