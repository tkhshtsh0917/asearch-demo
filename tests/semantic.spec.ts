/** Verifies the real optional encoder/vector pipeline under the production CSP and Pages prefix. */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";

const prepared = existsSync(".semantic/pin.json");
const required = process.env.SEMANTIC_REQUIRED === "1";
test.skip(
  !prepared && !required,
  "Optional semantic artifacts were not explicitly prepared",
);

async function ready(page: Page) {
  await page.goto("./");
  await expect(page.locator("#status")).toContainText("検索できます");
  await expect(page.locator("#semantic-enable")).toBeEnabled();
}
async function compose(page: Page, text: string) {
  await page.locator("#query").evaluate((element, text) => {
    const input = element as HTMLInputElement;
    input.dispatchEvent(
      new CompositionEvent("compositionstart", { bubbles: true }),
    );
    input.value = text;
    input.dispatchEvent(
      new InputEvent("input", { bubbles: true, isComposing: true }),
    );
  }, text);
}
async function semantic(page: Page) {
  const before = await page
    .locator("#semantic-results")
    .getAttribute("data-token");
  await page.locator("#semantic-enable").click();
  await expect(page.locator("#semantic-status")).toContainText("件提案", {
    timeout: 120000,
  });
  await expect(page.locator("#semantic-results")).not.toHaveAttribute(
    "data-token",
    before ?? "",
  );
}

test("explicit activation, filtering, coherent delta/compaction/restore and mobile layout", async ({
  page,
}) => {
  test.setTimeout(180000);
  const failures: string[] = [],
    requests: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("request", (request) => {
    const u = new URL(request.url());
    if (u.pathname.includes("/semantic/encoder-")) requests.push(u.pathname);
  });
  await ready(page);
  await page.locator("#query").fill("日本");
  await expect(page.locator("#results li").first()).toBeVisible();
  expect(requests).toEqual([]);
  await semantic(page);
  await expect(page.locator("#semantic-results li")).toHaveCount(5);
  const primary = await page
    .locator("#results li")
    .evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).dataset.key));
  const additional = await page
    .locator("#semantic-results li")
    .evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).dataset.key));
  expect(additional.every((key) => !primary.includes(key))).toBe(true);
  expect(new Set(additional).size).toBe(additional.length);
  const beforeComposition = await page
    .locator("#semantic-results")
    .getAttribute("data-token");
  await compose(page, "氷の惑星で野菜を育てたい");
  await expect(page.locator("#metrics")).toContainText("0件一致");
  await page.waitForTimeout(250);
  await expect(page.locator("#semantic-results li")).toHaveCount(0);
  await page.locator("#query").dispatchEvent("compositionend");
  await expect(page.locator("#semantic-status")).toContainText("件提案");
  await expect(page.locator("#semantic-results")).not.toHaveAttribute(
    "data-token",
    beforeComposition ?? "",
  );
  if (await page.locator("#filters-toggle").isVisible())
    await page.locator("#filters-toggle").click();
  await expect(
    page.locator("#article-options input:enabled").first(),
  ).toBeVisible();
  const option = page.locator("#article-options input:enabled").first(),
    title = await option.inputValue();
  const filteredBefore = await page
    .locator("#semantic-results")
    .getAttribute("data-token");
  await option.focus();
  await option.press("Space");
  await expect(page.locator("#semantic-results")).not.toHaveAttribute(
    "data-token",
    filteredBefore ?? "",
  );
  await expect(option).toBeFocused();
  const articles = await page
    .locator("#semantic-results li")
    .evaluateAll((nodes) =>
      nodes.map((n) => (n as HTMLElement).dataset.article),
    );
  expect(articles.length).toBeGreaterThan(0);
  expect(articles.every((value) => value === title)).toBe(true);
  await page.locator("#filters-clear").click();
  await page.locator("#query").fill("日本");
  await expect(page.locator("#results li").first()).toBeVisible();
  for (const stage of [1, 2]) {
    if (stage === 1)
      await page.route("**/semantic/delta.*.vecx", (route) => route.abort());
    await page.locator("#advance").click();
    await expect(page.locator("#status")).toContainText(`世代 ${stage + 1}`);
    await expect(page.locator("#status")).toContainText("検索できます");
    if (stage === 1) {
      await page.locator("#semantic-enable").click();
      await expect(page.locator("#semantic-status")).toContainText(
        "利用できません",
      );
      await expect(page.locator("#semantic-results li")).toHaveCount(0);
      await expect(page.locator("#results li").first()).toBeVisible();
      await page.unroute("**/semantic/delta.*.vecx");
    }
    await semantic(page);
    await expect(page.locator("#semantic-results")).toHaveAttribute(
      "data-stage",
      String(stage),
    );
  }
  await page.locator("#restore").click();
  await expect(page.locator("#status")).toContainText("世代 1");
  await semantic(page);
  await expect(page.locator("#semantic-results")).toHaveAttribute(
    "data-stage",
    "0",
  );
  await page.setViewportSize({ width: 320, height: 740 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(failures).toEqual([]);
});

test("semantic failure leaves primary available and a later attempt recovers", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.route(
    "**/semantic/encoder-*/models/ruri/model_quantized.onnx",
    (route) => route.abort(),
  );
  // Use the actual model filename from the pinned profile rather than relying on a label.
  const model = JSON.parse(
    readFileSync("integration/experiments/ruri/model.lock.json", "utf8"),
  ).files[0].path;
  await page.route(`**/semantic/encoder-*/models/ruri/${model}`, (route) =>
    route.abort(),
  );
  await ready(page);
  await page.locator("#query").fill("日本");
  await expect(page.locator("#results li").first()).toBeVisible();
  await page.locator("#semantic-enable").click();
  await expect(page.locator("#semantic-status")).toContainText(
    "利用できません",
    { timeout: 120000 },
  );
  await page.locator("#query").fill("大学");
  await expect(page.locator("#results li").first()).toBeVisible();
  await page.unroute(`**/semantic/encoder-*/models/ruri/${model}`);
  await page.unroute("**/semantic/encoder-*/models/ruri/model_quantized.onnx");
  await semantic(page);
});

test("late semantic results/errors cannot paint over a new query or IME composition", async ({
  page,
}) => {
  const worker = readdirSync("dist/assets").find(
    (name) =>
      name.endsWith(".js") &&
      readFileSync(`dist/assets/${name}`, "utf8").includes(
        "Lexical/vector publication mismatch",
      ),
  );
  expect(worker).toBeTruthy();
  await page.route(`**/assets/${worker}`, (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `self.onmessage=e=>{const q=e.data;if(q.kind!=='query')return;setTimeout(()=>self.postMessage({kind:'error',token:q.token,message:'obsolete error'}),200);setTimeout(()=>self.postMessage({kind:'result',token:q.token,rows:[],elapsed:1,snapshot:'x',stage:q.context.stage,catalogSha256:q.context.catalogSha256}),250);}`,
    }),
  );
  await ready(page);
  await page.locator("#query").fill("日本");
  await expect(page.locator("#results li").first()).toBeVisible();
  await page.locator("#semantic-enable").click();
  await expect(page.locator("#semantic-status")).toContainText("準備・実行");
  await compose(page, "にh");
  await page.waitForTimeout(350);
  await expect(page.locator("#semantic-status")).not.toContainText("obsolete");
  await expect(page.locator("#semantic-status")).not.toContainText("件提案");
  await expect(page.locator("#semantic-results li")).toHaveCount(0);
});

test("denied optional persistence falls back to verified static assets", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, "indexedDB", {
      configurable: true,
      get() {
        throw new DOMException("denied", "SecurityError");
      },
    });
  });
  // Worker globals have their own IndexedDB property; deny it in the encoder realm too.
  const directory = readdirSync("dist/semantic").find((name) =>
    name.startsWith("encoder-"),
  );
  expect(directory).toBeTruthy();
  const files = readdirSync(`dist/semantic/${directory}`);
  const name = files.find((n) => /^worker-.*\.js$/.test(n));
  expect(name).toBeTruthy();
  const body = readFileSync(`dist/semantic/${directory}/${name}`, "utf8");
  await page.route(`**/semantic/${directory}/${name}`, (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `Object.defineProperty(globalThis,'indexedDB',{get(){throw new DOMException('quota','QuotaExceededError')}});\n${body}`,
    }),
  );
  await ready(page);
  await page.locator("#query").fill("日本");
  await expect(page.locator("#results li").first()).toBeVisible();
  await semantic(page);
});
