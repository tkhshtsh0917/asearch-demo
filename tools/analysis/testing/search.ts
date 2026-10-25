/** Creates JS-owned ranked results and narrow Worker dependencies for offline tests. */
import type { SearchResult } from "asearch-wasm";
import { QueryPolicy } from "../../../src/shared/query.ts";
import { type SearchContext, search } from "../../../src/worker/search.ts";

export interface Hit {
  key: number;
  start: number;
  level?: number;
  ref?: number;
}

export function result(hits: Hit[], total = hits.length): SearchResult {
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

export function fixture(primary: SearchResult, alternative = result([])) {
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
    questions: new Map(
      [...primary.ids, ...alternative.ids].map((key) => [
        key,
        { key, text: `質問${key}`, title: "その他", url: "" },
      ]),
    ),
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

export function run(context: SearchContext, pattern = "にh", title?: string) {
  const response = search(
    {
      kind: "query",
      id: 1,
      pattern,
      ...(title === undefined ? {} : { title }),
    },
    3,
    context,
  );
  if (response.kind !== "results") throw new Error("Missing results");
  return response;
}
