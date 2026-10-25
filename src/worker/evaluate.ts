/** Combines at most two bounded query streams over the current catalog snapshot. */
import {
  mergeResults,
  type SearchResult,
  type SearchStats,
} from "asearch-wasm";
import type { Mode } from "../shared/protocol.ts";
import { corpusOptions, searchOptions } from "./options.ts";
import type { SearchContext } from "./search.ts";

/** Reports exact union counts only when the returned streams establish them. */
function count(results: readonly SearchResult[], unique: number) {
  const active = results
    .map((result) => ({
      length: result.length,
      known: result.totals !== undefined,
      total: result.totals
        ? Array.from(result.totals).reduce((sum, value) => sum + value, 0)
        : result.length,
    }))
    .filter((result) => result.total > 0);

  if (active.length <= 1)
    return {
      total: active[0]?.total ?? 0,
      totalIsExact: active[0]?.known ?? true,
    };

  const complete = active.every(
    (result) => result.known && result.total === result.length,
  );
  return {
    total: complete ? unique : Math.max(unique, ...active.map((r) => r.total)),
    totalIsExact: complete,
  };
}

/** Sums query work while counting the shared segment snapshot only once. */
function stats(results: readonly SearchResult[]): SearchStats {
  const first = results[0];
  if (!first) throw new Error("Missing query result");
  if (results.length === 1) return first.stats;
  const sum = (field: "blocks" | "earlyExitBlocks" | "reusedRows") =>
    results.reduce((total, result) => total + result.stats[field], 0);
  return {
    engine: "mixed",
    segments: first.stats.segments,
    blocks: sum("blocks"),
    earlyExitBlocks: sum("earlyExitBlocks"),
    reusedRows: sum("reusedRows"),
  };
}

/** Keeps the primary session incremental and uses temporary WASM state for an alternative. */
export function evaluate(pattern: string, mode: Mode, context: SearchContext) {
  const effective =
    mode === "corpus"
      ? (context.policy?.normalize(pattern) ?? pattern)
      : pattern;
  const patterns = [effective];
  const results = [
    mode === "corpus"
      ? context.session.update(effective)
      : context.intent.search(effective, searchOptions),
  ];

  const alternative =
    mode === "corpus" ? context.policy?.romanize(effective) : undefined;
  if (alternative !== undefined) {
    patterns.push(alternative);
    results.push(context.root.search(alternative, corpusOptions));
  }

  // JS-owned results survive the second WASM call. The pool never exceeds 40 hits.
  const hits = mergeResults(results, searchOptions.limit * results.length);
  return {
    hits,
    patterns,
    ...count(results, hits.ids.length),
    stats: stats(results),
  };
}
