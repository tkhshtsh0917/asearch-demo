import { expect, type Page, test } from "@playwright/test";

async function openUpdateExample(page: Page) {
  await page.goto("./");
  await expect(page.locator("#status")).toContainText("検索できます");
  await page.locator('[data-query="更新例"]').click();
  await expect(page.locator("#metrics")).toContainText("0件一致");
}

/** Releases a delayed failed response after reset to exercise abandoned Worker requests. */
async function delayFailure(page: Page, pattern: string) {
  const started = Promise.withResolvers<void>();
  const released = Promise.withResolvers<void>();
  const settled = Promise.withResolvers<void>();
  let intercepted = false;
  await page.route(pattern, async (route) => {
    intercepted = true;
    started.resolve();
    await released.promise;
    try {
      await route.fulfill({ status: 503, body: "Unavailable" });
    } finally {
      settled.resolve();
    }
  });
  return {
    started: started.promise,
    async release() {
      released.resolve();
      if (intercepted) await settled.promise;
      await page.unroute(pattern);
    },
  };
}

test("failed compaction preserves delta results and labels until a successful retry", async ({
  page,
}) => {
  await openUpdateExample(page);
  await page.locator("#advance").click();
  await expect(page.locator("#results .change-badge")).toHaveCount(4);
  const questions = await page.locator("#results .question").allTextContents();
  const labels = await page.locator("#results .change-badge").allTextContents();

  await page.route("**/compact.*.asix", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.locator("#advance").click();
  await expect(page.locator("#error")).toContainText("処理できませんでした");
  await expect(page.locator("#status")).toContainText("世代 2 · 索引2ファイル");
  await expect(page.locator('[data-stage="1"]')).toHaveAttribute(
    "aria-current",
    "step",
  );
  await expect(page.locator("#results .question")).toHaveText(questions);
  await expect(page.locator("#results .change-badge")).toHaveText(labels);
  await expect(page.locator("#change-legend")).toBeVisible();
  await expect(page.locator("#advance")).toBeEnabled();

  await page.unroute("**/compact.*.asix");
  await page.locator("#advance").click();
  await expect(page.locator("#status")).toContainText("世代 3 · 索引1ファイル");
  await expect(page.locator("#results .question")).toHaveText(questions);
  await expect(page.locator("#results .change-badge")).toHaveText(labels);
  await expect(page.locator("#error")).toBeEmpty();
});

for (const phase of ["delta", "compact"] as const) {
  test(`reset during a pending ${phase} ignores the abandoned response and clears update labels`, async ({
    page,
  }) => {
    await openUpdateExample(page);
    if (phase === "compact") {
      await page.locator("#advance").click();
      await expect(page.locator("#results .change-badge")).toHaveCount(4);
    }
    const pending = await delayFailure(page, `**/${phase}.*.asix`);
    try {
      await page.locator("#advance").click();
      await pending.started;
      await expect(page.locator("#status")).toContainText("更新を取得中");
      await page.locator("#reset").click();
      await expect(page.locator("#status")).toContainText(
        "世代 1 · 索引1ファイル · 検索できます",
      );
      await expect(page.locator("#metrics")).toContainText("0件一致");
    } finally {
      await pending.release();
    }

    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await expect(page.locator("#results li")).toHaveCount(0);
    await expect(page.locator("#change-legend")).toBeHidden();
    await expect(page.locator('[data-stage="0"]')).toHaveAttribute(
      "aria-current",
      "step",
    );
    await expect(page.locator("#error")).toBeEmpty();
    await expect(page.locator("#advance")).toBeEnabled();
    await expect(page.locator("#advance")).toHaveText("差分を適用");

    await page.locator("#advance").click();
    await expect(page.locator('#results [data-change="added"]')).toHaveCount(1);
    await expect(page.locator('#results [data-change="updated"]')).toHaveCount(
      3,
    );
  });
}

test("the compact header and update cards fit a 320px viewport across stages", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await openUpdateExample(page);
  const fits = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  expect(await fits()).toBe(true);
  for (const generation of [2, 3]) {
    await page.locator("#advance").click();
    await expect(page.locator("#status")).toContainText(`世代 ${generation}`);
    await expect(page.locator("#results .change-badge")).toHaveCount(4);
    expect(await fits()).toBe(true);
  }
  await page.locator("#reset").click();
  await expect(page.locator("#status")).toContainText("世代 1");
  expect(await fits()).toBe(true);
});
