/** Page rendering, accessibility, attribution and timing observation. */

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  installObservation,
  type Observation,
} from "../tools/bench/observe.ts";
import { open, query } from "./helpers.ts";

test("WASM search, explanations, intent DAG and attribution run without console errors", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await open(page);
  const header = page.locator("header");
  await expect(header.getByRole("heading", { level: 1 })).toHaveText(
    "asearch / playground",
  );
  await expect(header.locator(":scope > *")).toHaveCount(2);
  await expect(header.locator(".intro")).toContainText(
    "言葉を思い出しきれなくても、探し始められる。",
  );
  await expect(header.locator(".intro")).toContainText(
    "1万件の日本語の質問から、表記ゆれや少しの誤入力を越えて。",
  );
  await query(page, "大学");
  await expect(page.locator("#results li").first()).toBeVisible();
  await expect(page.locator("mark").first()).toBeVisible();
  await expect(page.locator("#results a").first()).toHaveAttribute(
    "href",
    /^https:\/\/ja.wikipedia.org\/wiki\//,
  );
  await expect(page.locator("footer")).toContainText("CC BY-SA 4.0");
  if (
    testInfo.project.name === "chromium" ||
    testInfo.project.name === "iphone-profile"
  )
    await page.screenshot({
      path: testInfo.outputPath("search.png"),
      fullPage: true,
    });
  await page.locator("#mode").selectOption("intent");
  await page.locator("#query").fill("電球交換");
  await expect(page.locator("#results")).toContainText("電球交換");
  await expect(page.locator("#metrics")).toContainText("dag");
  await page.locator("#query").fill("<img src=x onerror=alert(1)>");
  await expect(page.locator("#metrics")).toContainText("件一致");
  await expect(page.locator("#results img")).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("query examples select the matching mode and intent results never inherit corpus badges", async ({
  page,
}) => {
  await open(page);
  await page.locator("#advance").click();
  await expect(page.locator("#status")).toContainText("世代 2");
  await page.locator('[data-query="電球交換"]').click();
  await expect(page.locator("#mode")).toHaveValue("intent");
  await expect(page.locator("#results")).toContainText("電球交換");
  await expect(page.locator("#results [data-change]")).toHaveCount(0);
  await expect(page.locator("#change-legend")).toBeHidden();

  await page.locator('[data-query="更新例"]').click();
  await expect(page.locator("#mode")).toHaveValue("corpus");
  await expect(page.locator("#results .change-badge")).toHaveCount(4);
  await expect(page.locator("#change-legend")).toBeVisible();
});

test("search page has no serious accessibility violations", async ({
  page,
}) => {
  await open(page);
  await query(page, "大学");
  const report = await new AxeBuilder({ page }).analyze();
  expect(
    report.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
  await page.locator('[data-query="更新例"]').click();
  await page.locator("#advance").click();
  await expect(page.locator("#results .change-badge")).toHaveCount(4);
  const updated = await new AxeBuilder({ page }).analyze();
  expect(
    updated.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
});

test("redistributed code carries its own and dependency license notices", async ({
  request,
}) => {
  for (const name of [
    "demo-MIT.txt",
    "vite-LICENSE.md",
    "LICENSE-MIT",
    "LICENSE-APACHE",
    "NOTICE",
    "SudachiDict-LICENSE-2.0.txt",
    "SudachiDict-LEGAL",
    "elasticsearch-sudachi-LICENSE",
    "wana_kana-MIT.txt",
  ]) {
    const response = await request.get(`licenses/${name}`);
    expect(response.status()).toBe(200);
    expect((await response.text()).length).toBeGreaterThan(30);
  }
});

test("benchmark observer correlates Worker messages with accepted DOM changes", async ({
  page,
}) => {
  await page.addInitScript(installObservation);
  await open(page);
  await expect(page.locator("#metrics")).toContainText("入力してください");
  await query(page, "大学");
  const observed = await page.evaluate(
    () => (window as unknown as { __asearchBench: Observation }).__asearchBench,
  );
  expect(observed.readyMs).not.toBeNull();
  expect(observed.errors).toEqual([]);
  const sample = observed.samples.at(-1);
  expect(sample?.pattern).toBe("大学");
  expect(sample?.roundTripMs).toBeGreaterThanOrEqual(0);
  expect(sample?.domMs).toBeGreaterThanOrEqual(sample?.roundTripMs ?? Infinity);
  expect(sample?.workerMs).toBeGreaterThanOrEqual(0);
});
