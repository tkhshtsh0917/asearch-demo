import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  MAX_QUERY_RULE_BYTES,
  type QueryRules,
} from "../../src/shared/query.ts";
import { jsonAsset } from "../../src/worker/load.ts";
import { encodeQueryRules } from "./query-rules.ts";

/** Makes schema-valid tables with exact UTF-8 lengths, including multibyte sources. */
function rulesAtBytes(bytes: number): QueryRules {
  const rules: QueryRules = {
    format: "asearch-query-rules/1",
    forms: Array.from({ length: 8192 }, (_, i) => [
      `詞${String(i).padStart(9, "0")}`,
      "t".repeat(128),
    ]),
    kana: [],
  };
  let remaining = bytes - Buffer.byteLength(JSON.stringify(rules));
  for (const pair of rules.forms) {
    const padding = Math.min(128 - pair[0].length, remaining);
    pair[0] += "x".repeat(padding);
    remaining -= padding;
    if (remaining === 0) break;
  }
  assert.equal(remaining, 0);
  return rules;
}

for (const size of [MAX_QUERY_RULE_BYTES - 1, MAX_QUERY_RULE_BYTES]) {
  test(`published query data at ${size} bytes loads through the Worker boundary`, async (t) => {
    const rules = rulesAtBytes(size);
    const bytes = encodeQueryRules(rules);
    assert.equal(bytes.length, size);
    const hash = createHash("sha256").update(bytes).digest("hex");
    t.mock.method(globalThis, "fetch", async () => new Response(bytes));

    const loaded = await jsonAsset(
      new URL("https://example.test/"),
      "rules.json",
      MAX_QUERY_RULE_BYTES,
      hash,
    );
    assert.deepEqual(loaded, rules);
  });
}

test("query data above the final UTF-8 byte limit fails before publication", () => {
  assert.throws(
    () => encodeQueryRules(rulesAtBytes(MAX_QUERY_RULE_BYTES + 1)),
    /publication byte limit/,
  );
});
