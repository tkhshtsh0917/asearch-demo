/** Publication adoption, integrity and live-search behavior. */
import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { open, query } from "./helpers.ts";

test("delta and compacted snapshots preserve effective results, reset starts a fresh root", async ({
  page,
}, testInfo) => {
  await open(page);
  await page.locator('[data-query="更新例"]').click();
  await expect(page.locator("#metrics")).toContainText("0件一致");
  await expect(page.locator("#status")).toContainText("索引1ファイル");
  await expect(page.locator('[data-stage="0"]')).toHaveAttribute(
    "aria-current",
    "step",
  );
  await expect(page.locator("#change-legend")).toBeHidden();
  await page.locator("#advance").click();
  await expect(page.locator("#status")).toContainText("世代 2");
  await expect(page.locator("#status")).toContainText("索引2ファイル");
  await expect(page.locator("#delivery-detail")).toContainText(
    "追加1件・変更3件・削除1件",
  );
  await expect(page.locator('[data-stage="1"]')).toHaveAttribute(
    "aria-current",
    "step",
  );
  await expect(page.locator("#results li")).toHaveCount(4);
  await expect(page.locator('#results [data-change="added"]')).toHaveCount(1);
  await expect(page.locator('#results [data-change="updated"]')).toHaveCount(3);
  await expect(page.locator("#change-legend")).toBeVisible();
  const texts = await page.locator("#results .question").allTextContents();
  const badges = await page.locator("#results .change-badge").allTextContents();
  if (
    testInfo.project.name === "chromium" ||
    testInfo.project.name === "iphone-profile"
  )
    await page.screenshot({
      path: testInfo.outputPath("updates.png"),
      fullPage: true,
    });
  await page.locator("#advance").click();
  await expect(page.locator("#status")).toContainText("世代 3");
  await expect(page.locator("#status")).toContainText("索引1ファイル");
  await expect(page.locator('[data-stage="2"]')).toHaveAttribute(
    "aria-current",
    "step",
  );
  await expect(page.locator("#results .question")).toHaveText(texts);
  await expect(page.locator("#results .change-badge")).toHaveText(badges);
  await expect(page.locator("#delivery-detail")).toContainText(
    "検索結果と追加・変更のラベルはそのまま",
  );
  await page.locator("#reset").click();
  await expect(page.locator("#status")).toContainText("世代 1");
  await expect(page.locator("#metrics")).toContainText("0件一致");
  await expect(page.locator('[data-stage="0"]')).toHaveAttribute(
    "aria-current",
    "step",
  );
  await expect(page.locator("#results [data-change]")).toHaveCount(0);
  await expect(page.locator("#change-legend")).toBeHidden();
});

test("failed integrity leaves old search usable and can be retried", async ({
  page,
}) => {
  await open(page);
  await query(page, "大学");
  const before = await page.locator("#results .question").allTextContents();
  await page.route("**/delta.*.asix", async (route) => {
    const response = await route.fetch();
    const bytes = await response.body();
    bytes[bytes.length - 1] = (bytes.at(-1) ?? 0) ^ 1;
    await route.fulfill({ response, body: bytes });
  });
  await page.locator("#advance").click();
  await expect(page.locator("#error")).toContainText("処理できませんでした");
  await expect(page.locator("#status")).toContainText("世代 1");
  await expect(page.locator("#status")).toContainText("索引1ファイル");
  await expect(page.locator('[data-stage="0"]')).toHaveAttribute(
    "aria-current",
    "step",
  );
  await expect(page.locator("#results [data-change]")).toHaveCount(0);
  await expect(page.locator("#results .question")).toHaveText(before);
  await page.unroute("**/delta.*.asix");
  await page.locator("#advance").click();
  await expect(page.locator("#status")).toContainText("世代 2");
  await expect(page.locator("#error")).toBeEmpty();
});

test("search continues during a delayed update and latest input survives adoption", async ({
  page,
}) => {
  await open(page);
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested: () => void = () => {};
  const started = new Promise<void>((resolve) => {
    requested = resolve;
  });
  await page.route("**/delta.*.asix", async (route) => {
    requested();
    await gate;
    await route.continue();
  });
  await page.locator("#advance").click();
  await started;
  await expect(page.locator('[data-stage="0"]')).toHaveAttribute(
    "aria-current",
    "step",
  );
  await expect(page.locator("#status")).toContainText("索引1ファイル");
  await query(page, "大学");
  await expect(page.locator("#results li").first()).toBeVisible();
  await page.locator("#query").fill("更新例");
  await expect(page.locator("#metrics")).toContainText("0件一致");
  release();
  await expect(page.locator("#status")).toContainText("世代 2");
  await expect(page.locator("#results li")).toHaveCount(4);
  await expect(page.locator("#query")).toHaveValue("更新例");
});

test("valid manifests are independent of JSON property ordering", async ({
  page,
}) => {
  await page.route("**/data/release.json", async (route) => {
    const response = await route.fetch();
    const publication = await response.json();
    for (const stage of publication.stages) {
      const source = await page.request.get(
        new URL(stage.manifest, response.url()).href,
      );
      const manifest = await source.json(),
        index = manifest.index;
      manifest.index = {
        normalizer: {
          options: index.normalizer.options,
          version: index.normalizer.version,
          id: index.normalizer.id,
        },
        symbol_unit: index.symbol_unit,
        minor: index.minor,
        major: index.major,
      };
      const body = JSON.stringify(manifest),
        hash = createHash("sha256").update(body).digest("hex").slice(0, 20);
      stage.manifest = `manifest.${hash}.json`;
      await page.route(`**/${stage.manifest}`, (asset) =>
        asset.fulfill({ contentType: "application/json", body }),
      );
    }
    await route.fulfill({ response, json: publication });
  });
  await open(page);
  await page.locator("#advance").click();
  await expect(page.locator("#status")).toContainText("世代 2");
  await expect(page.locator("#error")).toBeEmpty();
});

test("a modified body at an immutable manifest URL cannot replace the active stage", async ({
  page,
}) => {
  await open(page);
  await query(page, "大学");
  const before = await page.locator("#results .question").allTextContents();
  await page.route("**/manifest.*.json", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()} ` });
  });
  await page.locator("#advance").click();
  await expect(page.locator("#error")).toContainText("処理できませんでした");
  await expect(page.locator("#status")).toContainText("世代 1");
  await expect(page.locator("#results .question")).toHaveText(before);
  await page.unroute("**/manifest.*.json");
  await page.locator("#advance").click();
  await expect(page.locator("#status")).toContainText("世代 2");
  await expect(page.locator("#error")).toBeEmpty();
});
