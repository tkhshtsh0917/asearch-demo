/** Shared readiness and input helpers; assertions remain specific to each scenario. */
import { expect, type Page } from "@playwright/test";

export async function open(page: Page) {
  await page.goto("./");
  await expect(page.locator("#status")).toContainText("検索できます");
}

export async function query(page: Page, text: string) {
  await page.locator("#query").fill(text);
  await expect(page.locator("#metrics")).toContainText("件一致");
}
