import { expect, test } from "@playwright/test";

test("default segment workload crosses the browser fixture transport", async ({
  page,
}) => {
  await page.goto("/tests/browser/fixtures/index.html");
  const result = await page.evaluate(async () => {
    // @ts-expect-error Fixture adapter is generated during integration build.
    const api = await import("/tests/fixtures/browser-api.mjs");
    const docs = Array.from({ length: 10000 }, (_, key) => ({
      key,
      texts: [`質問 ${key} 日本の歴史と地理の使い方`, `question ${key} abcdef`],
    }));
    const bytes = await api.buildIndex(docs);
    const index = api.AsearchIndex.fromBytes(bytes);
    try {
      return { bytes: bytes.length, segments: index.segments().length };
    } finally {
      index.free();
    }
  });
  expect(result.bytes).toBeGreaterThan(0);
  expect(result.segments).toBe(1);
});
