/** Query spelling, composition, normalization and ranking regressions. */
import { expect, test } from "@playwright/test";
import type { Observation } from "../tools/bench/observe.ts";
import { open, query } from "./helpers.ts";

test("composition searches intermediate text and subsequent typing wins", async ({
  page,
}) => {
  await open(page);
  await query(page, "大学");
  await page.locator("#query").evaluate((input) => {
    input.dispatchEvent(
      new CompositionEvent("compositionstart", { bubbles: true }),
    );
    (input as HTMLInputElement).value = "更新例";
    input.dispatchEvent(
      new InputEvent("input", { bubbles: true, isComposing: true }),
    );
  });
  await expect(page.locator("#metrics")).toContainText("0件一致");
  await expect(page.locator("#results li")).toHaveCount(0);
  await expect(page.locator("#query")).toHaveValue("更新例");
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

test("IME replacement and cancellation search the entire restored value", async ({
  page,
}) => {
  await open(page);
  await query(page, "更新例");

  await page.locator("#query").evaluate((element) => {
    const input = element as HTMLInputElement;
    input.dispatchEvent(new CompositionEvent("compositionstart"));
    input.value = "大学";
    input.dispatchEvent(
      new InputEvent("input", { bubbles: true, isComposing: true }),
    );
  });
  await expect(page.locator("#results li").first()).toBeVisible();

  await page.locator("#query").evaluate((element) => {
    const input = element as HTMLInputElement;
    input.value = "更新例";
    input.dispatchEvent(new CompositionEvent("compositionend", { data: "" }));
    input.dispatchEvent(new InputEvent("input", { bubbles: true }));
  });
  await expect(page.locator("#metrics")).toContainText("0件一致");
  await expect(page.locator("#results li")).toHaveCount(0);
  await expect(page.locator("#query")).toHaveValue("更新例");
});

test("script, case, romaji and synonym queries display the same original questions", async ({
  page,
}) => {
  await open(page);
  let originals: string[] | undefined;

  for (const pattern of [
    "ビートルズ",
    "Beatles",
    "BEATLES",
    "beatles",
    "びーとるず",
    "biitoruzu",
    "bi-toruzu",
  ]) {
    await query(page, pattern);
    const questions = await page
      .locator("#results .question")
      .allTextContents();
    expect(questions.length).toBeGreaterThan(0);
    expect([...questions].sort()).toEqual([...(originals ?? questions)].sort());
    originals = questions;
  }

  await expect(page.locator(".search-alias").first()).toContainText(
    "検索用表現:",
  );
  await expect(page.locator("#error")).toBeEmpty();
});

test("mixed composition alternatives and verb normalization preserve the visible query", async ({
  page,
}) => {
  await open(page);
  await page.locator("#query").evaluate((element) => {
    const input = element as HTMLInputElement;
    input.dispatchEvent(
      new CompositionEvent("compositionstart", { bubbles: true }),
    );
    input.value = "びーt";
    input.setSelectionRange(3, 3);
    input.dispatchEvent(
      new InputEvent("input", { bubbles: true, isComposing: true }),
    );
  });
  await expect(page.locator("#results")).toContainText("ビートルズ");
  await expect(page.locator("#query")).toHaveValue("びーt");
  expect(
    await page
      .locator("#query")
      .evaluate((e) => (e as HTMLInputElement).selectionStart),
  ).toBe(3);
  await page.locator("#query").dispatchEvent("compositionend");

  const questions: string[][] = [];
  for (const value of ["食べた", "食べる", "食べました"]) {
    await query(page, value);
    questions.push(await page.locator("#results .question").allTextContents());
    await expect(page.locator("#query")).toHaveValue(value);
  }
  expect(questions[0]?.length).toBeGreaterThan(0);
  expect(questions[1]).toEqual(questions[0]);
  expect(questions[2]).toEqual(questions[0]);
});

test("short roman prefixes rank ahead of interior substring aliases", async ({
  page,
}) => {
  await open(page);
  await query(page, "bi");
  await expect(
    page.locator("#results li").first().locator(".search-alias"),
  ).toHaveText(/^検索用表現:\s*bi/i);
  await expect(page.locator("#results li").first()).not.toContainText(
    "possibility",
  );
});

test("literal rocket hits do not hide Japan during composition", async ({
  page,
}) => {
  await open(page);
  await page.locator("#query").evaluate((input) => {
    input.dispatchEvent(
      new CompositionEvent("compositionstart", { bubbles: true }),
    );
    (input as HTMLInputElement).value = "にh";
    input.dispatchEvent(
      new InputEvent("input", { bubbles: true, isComposing: true }),
    );
  });
  await page.waitForFunction(
    () =>
      (
        window as unknown as { __asearchBench: Observation }
      ).__asearchBench.samples.at(-1)?.pattern === "にh",
  );
  expect(
    (await page.locator("#results .question").allTextContents()).some((text) =>
      text.includes("日本"),
    ),
  ).toBe(true);
  await expect(page.locator("#query")).toHaveValue("にh");
  await page.locator("#query").dispatchEvent("compositionend");

  await query(page, "に");
  await expect(page.locator("#metrics")).toContainText("少なくとも");
  await expect(page.locator("#error")).toBeEmpty();
});
