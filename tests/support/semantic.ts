/** Shares optional-publication readiness and waits for a new accepted semantic render. */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";

export function requireSemanticAssets() {
  test.skip(
    !existsSync(".semantic/pin.json") && process.env.SEMANTIC_REQUIRED !== "1",
    "Optional semantic artifacts were not explicitly prepared",
  );
}

export function semanticWorkerAsset(): string {
  const name = readdirSync("dist/assets").find(
    (name) =>
      name.endsWith(".js") &&
      readFileSync(`dist/assets/${name}`, "utf8").includes(
        "Lexical/vector publication mismatch",
      ),
  );
  if (!name) throw new Error("Missing built semantic Worker");
  return name;
}

export async function semanticReady(page: Page) {
  await page.goto("./");
  await expect(page.locator("#status")).toContainText("検索できます");
  await expect(page.locator("#semantic-enable")).toBeEnabled();
}

export async function semanticQuery(page: Page) {
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
