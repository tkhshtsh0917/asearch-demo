/** Rejects stale bundles and source changes during an experiment. */
import assert from "node:assert/strict";
import type { Page } from "@playwright/test";
import { sourceIdentity } from "./identity.ts";

export async function assertBuild(page: Page, root: string) {
  const expected = await sourceIdentity(root);
  const actual = await page.evaluate(
    () =>
      (globalThis as unknown as { ruriProbe: { sourceIdentity: string } })
        .ruriProbe.sourceIdentity,
  );
  assert.equal(
    actual,
    expected,
    "Built probe does not match source; rebuild before measuring",
  );
  return expected;
}
