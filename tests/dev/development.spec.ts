import { expect, test } from "@playwright/test";

test("development CSS and Worker search work without CSP errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
  await expect(page.locator("#status")).toContainText("検索できます");
  await expect(page.locator("body")).toHaveCSS("color", "rgb(36, 35, 57)");
  await page.locator("#query").fill("大学");
  await expect(page.locator("#results li").first()).toBeVisible();
  expect(errors).toEqual([]);
});
