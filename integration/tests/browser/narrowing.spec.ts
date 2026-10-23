import { expect, test } from "@playwright/test";

test("narrowing preserves ranks and counts across the scalar word boundary", async ({
  page,
}) => {
  await page.goto("/tests/browser/fixtures/index.html");
  const result = await page.evaluate(async () => {
    // @ts-expect-error Browser-only absolute module URL.
    const api = await import("/tests/fixtures/browser-api.mjs");
    const text = "abcdefghij".repeat(9);
    const docs = Array.from({ length: 512 }, (_, key) => ({
      key,
      texts: ["z".repeat(1024)],
    }));
    docs.push({ key: 512, texts: [text] });
    const index = await api.AsearchIndex.fromDocs(docs, {
      limits: { maxPatternUnits: 128 },
    });
    const options = { maxAmbig: 3, countTotal: true };
    const session = index.session(options);
    const checks = [];
    try {
      for (const length of [30, 31, 32, 62, 63, 64, 65, 70, 90]) {
        const pattern = text.slice(0, length);
        const actual = session.update(pattern);
        const expected = index.search(pattern, options);
        const equal = ["ids", "levels", "orders", "totals"].every(
          (field) =>
            JSON.stringify([...actual[field]]) ===
            JSON.stringify([...expected[field]]),
        );
        checks.push(
          equal && (length === 30 || actual.stats.narrowedTexts === 1),
        );
      }
      return checks;
    } finally {
      session.free();
      index.free();
    }
  });
  expect(result).toEqual(Array(9).fill(true));
});
