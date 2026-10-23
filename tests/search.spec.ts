import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import {
  installObservation,
  type Observation,
} from "../tools/bench/observe.ts";

async function open(page: Page) {
  await page.goto("./");
  await expect(page.locator("#status")).toContainText("検索できます");
}

async function query(page: Page, text: string) {
  await page.locator("#query").fill(text);
  await expect(page.locator("#metrics")).toContainText("件一致");
}

test("WASM search, explanations, intent DAG and attribution run without console errors", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await open(page);
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

test("delta and compacted snapshots preserve effective results, reset starts a fresh root", async ({
  page,
}) => {
  await open(page);
  await query(page, "更新例");
  await expect(page.locator("#metrics")).toContainText("0件一致");
  await page.locator("#advance").click();
  await expect(page.locator("#status")).toContainText("世代 2");
  await expect(page.locator("#results li")).toHaveCount(4);
  const texts = await page.locator("#results .question").allTextContents();
  await page.locator("#advance").click();
  await expect(page.locator("#status")).toContainText("世代 3");
  await expect(page.locator("#results .question")).toHaveText(texts);
  await page.locator("#reset").click();
  await expect(page.locator("#status")).toContainText("世代 1");
  await expect(page.locator("#metrics")).toContainText("0件一致");
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
  await query(page, "大学");
  await expect(page.locator("#results li").first()).toBeVisible();
  await page.locator("#query").fill("更新例");
  await expect(page.locator("#metrics")).toContainText("0件一致");
  release();
  await expect(page.locator("#status")).toContainText("世代 2");
  await expect(page.locator("#results li")).toHaveCount(4);
  await expect(page.locator("#query")).toHaveValue("更新例");
});

test("composition suppresses intermediate requests and subsequent typing wins", async ({
  page,
}) => {
  await open(page);
  await query(page, "大学");
  const before = await page.locator("#metrics").textContent();
  await page.locator("#query").evaluate((input) => {
    input.dispatchEvent(
      new CompositionEvent("compositionstart", { bubbles: true }),
    );
    (input as HTMLInputElement).value = "更新例";
    input.dispatchEvent(
      new InputEvent("input", { bubbles: true, isComposing: true }),
    );
  });
  await page.waitForTimeout(100);
  expect(await page.locator("#metrics").textContent()).toBe(before);
  await page.locator("#query").evaluate((input) => {
    input.dispatchEvent(
      new CompositionEvent("compositionend", { bubbles: true, data: "更新例" }),
    );
  });
  await expect(page.locator("#metrics")).toContainText("0件一致");
  await expect(page.locator("#results li")).toHaveCount(0);
  await page.locator("#query").fill("大学");
  await page.locator("#query").fill("更新例");
  await expect(page.locator("#metrics")).toContainText("0件一致");
  await expect(page.locator("#results li")).toHaveCount(0);
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
  ]) {
    const response = await request.get(`licenses/${name}`);
    expect(response.status()).toBe(200);
    expect((await response.text()).length).toBeGreaterThan(30);
  }
});

test("valid manifests are independent of JSON property ordering", async ({
  page,
}) => {
  await page.route("**/manifest.*.json", async (route) => {
    const response = await route.fetch();
    const manifest = await response.json();
    const index = manifest.index;
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
    await route.fulfill({ response, json: manifest });
  });
  await open(page);
  await page.locator("#advance").click();
  await expect(page.locator("#status")).toContainText("世代 2");
  await expect(page.locator("#error")).toBeEmpty();
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
