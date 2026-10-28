/** Exercises Worker startup failures without losing primary search or a later retry. */
import { expect, test } from "@playwright/test";
import {
  requireSemanticAssets,
  semanticQuery,
  semanticReady,
  semanticWorkerAsset,
} from "./support/semantic.ts";

requireSemanticAssets();

for (const changeInput of [false, true]) {
  test(`failed semantic startup retires its instance${changeInput ? " after the input changes" : " for the current input"}`, async ({
    page,
  }) => {
    test.setTimeout(180000);
    const asset = semanticWorkerAsset();
    const failures: string[] = [];
    page.on("pageerror", (error) => failures.push(error.message));
    await page.addInitScript((asset) => {
      const Native = window.Worker;
      Object.assign(window, { __semanticStartupErrors: 0 });
      window.Worker = class extends Native {
        constructor(...args: ConstructorParameters<typeof Worker>) {
          super(...args);
          if (String(args[0]).endsWith(asset))
            this.addEventListener("error", () => {
              const state = window as unknown as {
                __semanticStartupErrors: number;
              };
              ++state.__semanticStartupErrors;
            });
        }
      };
    }, asset);
    let release = () => {},
      started = () => {},
      requests = 0;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const requested = new Promise<void>((resolve) => {
      started = resolve;
    });
    await page.route(`**/assets/${asset}`, async (route) => {
      if (++requests !== 1) return route.continue();
      started();
      await gate;
      await route.fulfill({
        contentType: "text/javascript",
        body: 'throw new Error("controlled startup failure")',
      });
    });
    await semanticReady(page);
    await page.locator("#query").fill("日本");
    await expect(page.locator("#results li").first()).toBeVisible();
    await page.locator("#semantic-enable").click();
    await requested;
    if (changeInput) {
      await page.locator("#query").fill("大学");
      await expect(page.locator("#semantic-status")).toHaveText(
        "文字検索とは別に、意味が近い質問を提案します。",
      );
    }
    release();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { __semanticStartupErrors: number })
              .__semanticStartupErrors,
        ),
      )
      .toBe(1);
    if (changeInput)
      await expect(page.locator("#semantic-status")).not.toContainText(
        "停止しました",
      );
    else
      await expect(page.locator("#semantic-status")).toContainText(
        "停止しました",
      );

    await semanticQuery(page);
    expect(requests).toBe(2);
    await expect(page.locator("#semantic-results li")).toHaveCount(5);
    await expect(page.locator("#results li").first()).toBeVisible();
    expect(failures).toEqual([]);
  });
}

test("a synchronous optional Worker construction failure can be retried", async ({
  page,
}) => {
  test.setTimeout(180000);
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  await page.addInitScript((asset) => {
    const Native = window.Worker;
    let attempts = 0;
    window.Worker = class extends Native {
      constructor(...args: ConstructorParameters<typeof Worker>) {
        if (String(args[0]).endsWith(asset) && ++attempts === 1)
          throw new DOMException(
            "controlled constructor failure",
            "SecurityError",
          );
        super(...args);
      }
    };
  }, semanticWorkerAsset());
  await semanticReady(page);
  await page.locator("#query").fill("日本");
  await expect(page.locator("#results li").first()).toBeVisible();
  await page.locator("#semantic-enable").click();
  await expect(page.locator("#semantic-status")).toContainText(
    "起動できません",
  );
  await semanticQuery(page);
  expect(failures).toEqual([]);
});

test("message decoding failure recovers and a retired instance cannot stop its replacement", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.addInitScript((asset) => {
    const Native = window.Worker;
    const instances: Worker[] = [];
    Object.assign(window, { __semanticInstances: instances });
    window.Worker = class extends Native {
      constructor(...args: ConstructorParameters<typeof Worker>) {
        super(...args);
        if (String(args[0]).endsWith(asset)) instances.push(this);
      }
    };
  }, semanticWorkerAsset());
  await semanticReady(page);
  await page.locator("#query").fill("日本");
  await expect(page.locator("#results li").first()).toBeVisible();
  await semanticQuery(page);
  const before = await page
    .locator("#semantic-results")
    .getAttribute("data-token");
  await page.evaluate(() => {
    const state = window as unknown as { __semanticInstances: Worker[] };
    const old = state.__semanticInstances[0];
    if (!old?.onerror) throw new Error("Missing active semantic error handler");
    Object.assign(window, { __retiredSemanticError: old.onerror.bind(old) });
    old.dispatchEvent(new MessageEvent("messageerror"));
  });
  await expect(page.locator("#semantic-status")).toContainText(
    "応答を受け取れません",
  );

  await page.locator("#semantic-enable").click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { __semanticInstances: Worker[] })
            .__semanticInstances.length,
      ),
    )
    .toBe(2);
  await page.evaluate(() => {
    const state = window as unknown as {
      __retiredSemanticError: (event: ErrorEvent) => void;
    };
    state.__retiredSemanticError(new ErrorEvent("error", { cancelable: true }));
  });
  await expect(page.locator("#semantic-status")).not.toContainText(
    "停止しました",
  );
  await expect(page.locator("#semantic-status")).toContainText("件提案", {
    timeout: 120000,
  });
  await expect(page.locator("#semantic-results")).not.toHaveAttribute(
    "data-token",
    before ?? "",
  );
  await expect(page.locator("#results li").first()).toBeVisible();
});
