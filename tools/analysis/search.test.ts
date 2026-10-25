/** Exercises query combination, count bounds and reference ownership without network data. */
import assert from "node:assert/strict";
import test from "node:test";
import type { SearchResult } from "asearch-wasm";
import type { Mode } from "../../src/shared/protocol.ts";
import { QueryPolicy } from "../../src/shared/query.ts";
import { type SearchContext, search } from "../../src/worker/search.ts";

interface Hit {
  key: number;
  start: number;
  level?: number;
  ref?: number;
}

function result(hits: Hit[], total = hits.length): SearchResult {
  return {
    ids: Uint32Array.from(hits.map((hit) => hit.key)),
    orders: Uint32Array.from(hits.map((hit) => hit.key)),
    refs: Uint32Array.from(hits.map((hit) => hit.ref ?? hit.key)),
    starts: Uint32Array.from(hits.map((hit) => hit.start)),
    levels: Uint8Array.from(hits.map((hit) => hit.level ?? 0)),
    length: hits.length,
    totals: Uint32Array.of(total),
    stats: {
      engine: "transposed-blocked",
      segments: 1,
      blocks: 1,
      earlyExitBlocks: 0,
      reusedRows: 0,
    },
    copy: () => result(hits, total),
  };
}

function fixture(primary: SearchResult, alternative = result([])) {
  const calls: string[] = [];
  const explanations: [number, string][] = [];
  const context: SearchContext = {
    root: {
      search: (pattern) => {
        calls.push(`alternative:${pattern}`);
        return alternative;
      },
      explain: (ref, pattern) => {
        explanations.push([ref, pattern]);
        return null;
      },
    },
    session: {
      update: (pattern) => {
        calls.push(`primary:${pattern}`);
        return primary;
      },
      reset: () => calls.push("reset"),
    },
    intent: { search: () => primary, explain: () => null },
    questions: new Map(),
    policy: new QueryPolicy({
      format: "asearch-query-rules/1",
      forms: [["食べた", "食べる"]],
      kana: [
        ["に", "ni"],
        ["び", "bi"],
        ["ー", "-"],
      ],
    }),
  };
  return { context, calls, explanations };
}

function run(context: SearchContext, pattern = "にh", mode: Mode = "corpus") {
  const response = search({ kind: "query", id: 1, pattern, mode }, 3, context);
  if (response.kind !== "results") throw new Error("Missing results");
  return response;
}

test("literal hits do not suppress a convertible query and positional ranking is global", () => {
  const { context, calls } = fixture(
    result([{ key: 1, start: 12 }]),
    result([{ key: 2, start: 0 }]),
  );
  const response = run(context);
  assert.deepEqual(calls, ["primary:にh", "alternative:nih"]);
  assert.deepEqual(
    response.rows.map((row) => row.key),
    [2, 1],
  );
  assert.equal(response.total, 2);
  assert.equal(response.totalIsExact, true);
  assert.equal(response.stats?.blocks, 2);
  assert.equal(response.stats?.segments, 1);
});

test("the best duplicate owns its explanation, with literal preference only on an exact rank tie", () => {
  for (const [start, ref, effective] of [
    [0, 202, "nih"],
    [10, 101, "にh"],
  ] as const) {
    const { context, explanations } = fixture(
      result([{ key: 1, start: 10, ref: 101 }]),
      result([{ key: 1, start, ref: 202 }]),
    );
    const response = run(context);
    assert.equal(response.rows.length, 1);
    assert.equal(response.total, 1);
    assert.deepEqual(explanations, [[ref, effective]]);
  }
});

test("edit distance precedes match start across literal and romanized candidates", () => {
  const { context } = fixture(
    result([{ key: 1, start: 30 }]),
    result([{ key: 2, start: 0, level: 1 }]),
  );
  assert.deepEqual(
    run(context).rows.map((row) => row.key),
    [1, 2],
  );
});

test("overlapping truncated streams report a lower bound without summing totals", () => {
  const left = Array.from({ length: 20 }, (_, key) => ({ key, start: key }));
  const right = Array.from({ length: 20 }, (_, key) => ({
    key: key + 10,
    start: key,
  }));
  const bounded = run(fixture(result(left, 200), result(right, 180)).context);
  assert.equal(bounded.total, 200);
  assert.equal(bounded.totalIsExact, false);
  assert.equal(bounded.rows.length, 20);
  assert.equal(new Set(bounded.rows.map((row) => row.key)).size, 20);

  const complete = run(fixture(result(left), result(right)).context);
  assert.equal(complete.total, 30);
  assert.equal(complete.totalIsExact, true);
  assert.equal(complete.rows.length, 20);

  const single = run(fixture(result(left, 200)).context);
  assert.equal(single.total, 200);
  assert.equal(single.totalIsExact, true);
});

test("unchanged, oversized and intent queries do not trigger a second search", () => {
  for (const [pattern, mode, expected] of [
    ["日本", "corpus", ["primary:日本"]],
    ["び".repeat(65), "corpus", [`primary:${"び".repeat(65)}`]],
    ["にh", "intent", []],
    ["  ", "corpus", ["reset"]],
  ] as const) {
    const { context, calls } = fixture(result([]));
    run(context, pattern, mode);
    assert.deepEqual(calls, expected);
  }
});

test("a failed alternative is surfaced and a later literal query still recovers", () => {
  const { context, calls } = fixture(result([{ key: 1, start: 0 }]));
  context.root.search = () => {
    throw new Error("RESOURCE_LIMIT");
  };
  assert.throws(() => run(context), /RESOURCE_LIMIT/);
  assert.equal(run(context, "日本").rows[0]?.key, 1);
  assert.deepEqual(calls, ["primary:にh", "primary:日本"]);
});
