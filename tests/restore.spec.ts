import { expect, test } from "@playwright/test";

for (const initialStage of [1, 2]) {
  test(`restoring from stage ${initialStage + 1} preserves input and can apply the delta again`, async ({
    page,
  }) => {
    await page.goto("./");
    await expect(page.locator("#status")).toContainText("検索できます");
    await expect(page.locator("#restore")).toBeDisabled();
    await page.locator('[data-query="更新例"]').click();
    for (let stage = 0; stage < initialStage; stage++) {
      await page.locator("#advance").click();
      await expect(page.locator("#status")).toContainText(`世代 ${stage + 2}`);
    }
    await expect(page.locator("#results .change-badge")).toHaveCount(4);
    await page.locator("#restore").click();
    await expect(page.locator("#status")).toContainText(
      "世代 1 · 索引1ファイル",
    );
    await expect(page.locator("#query")).toHaveValue("更新例");
    await expect(page.locator("#metrics")).toContainText("0件一致");
    await expect(page.locator("#results li")).toHaveCount(0);
    await expect(page.locator("#change-legend")).toBeHidden();
    await expect(page.locator("#restore")).toBeDisabled();
    await page.locator("#advance").click();
    await expect(page.locator('#results [data-change="added"]')).toHaveCount(1);
    await expect(page.locator('#results [data-change="updated"]')).toHaveCount(
      3,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test("failed restore preserves current results and can be retried", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.locator("#status")).toContainText("検索できます");
  await page.locator('[data-query="更新例"]').click();
  await page.locator("#advance").click();
  await expect(page.locator("#results .change-badge")).toHaveCount(4);
  const questions = await page.locator("#results .question").allTextContents();
  await page.route("**/base.*.asix", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.locator("#restore").click();
  await expect(page.locator("#error")).toContainText("処理できませんでした");
  await expect(page.locator("#status")).toContainText("世代 2 · 索引2ファイル");
  await expect(page.locator("#results .question")).toHaveText(questions);
  await expect(page.locator("#results .change-badge")).toHaveCount(4);
  await expect(page.locator("#restore")).toBeEnabled();
  await page.unroute("**/base.*.asix");
  await page.locator("#restore").click();
  await expect(page.locator("#metrics")).toContainText("0件一致");
  await expect(page.locator("#error")).toBeEmpty();
});
