import assert from "node:assert/strict";
import test from "node:test";
import { QueryPolicy, queryRules } from "../../src/shared/query.ts";

const rules = {
  format: "asearch-query-rules/1" as const,
  forms: [
    ["食べた", "食べる"],
    ["食べました", "食べる"],
  ] as [string, string][],
  kana: [
    ["び", "bi"],
    ["ビ", "bi"],
    ["ー", "-"],
    ["きゃ", "kya"],
    ["んあ", "n'a"],
  ] as [string, string][],
};

test("whole-term normalization preserves unknown context, negatives and whitespace", () => {
  const policy = new QueryPolicy(rules);
  assert.equal(policy.normalize("食べた"), "食べる");
  assert.equal(policy.normalize("食べる"), "食べる");
  assert.equal(policy.normalize("食べました  寿司"), "食べる  寿司");
  for (const text of ["食べない", "食べたくない", "食べたもの", "見た目"])
    assert.equal(policy.normalize(text), text);
  assert.equal(policy.normalize(policy.normalize("食べた")), "食べる");
});

test("mixed IME lookup uses longest rules, preserves unknown letters and bounds expansion", () => {
  const policy = new QueryPolicy(rules);
  assert.equal(policy.fallback("びーt"), "bi-t");
  assert.equal(policy.fallback("ビーT"), "bi-T");
  assert.equal(policy.fallback("きゃt"), "kyat");
  assert.equal(policy.fallback("んあ"), "n'a");
  assert.equal(policy.fallback("beatles"), undefined);
  assert.equal(policy.fallback("び".repeat(65)), undefined);
});

test("query rules reject duplicate, chained, excessive and malformed data", () => {
  for (const forms of [
    [
      ["x", "y"],
      ["x", "z"],
    ],
    [
      ["x", "y"],
      ["y", "z"],
    ],
    [["x x", "y"]],
    [["x", "y".repeat(129)]],
  ])
    assert.throws(() => queryRules({ ...rules, forms }));
  assert.throws(() => queryRules({ ...rules, format: "unknown" }));
  assert.throws(() => queryRules({ ...rules, kana: [["abcd", "a"]] }));
  assert.throws(() =>
    queryRules({
      ...rules,
      forms: Array.from({ length: 50001 }, (_, i) => [String(i), "x"]),
    }),
  );
});
