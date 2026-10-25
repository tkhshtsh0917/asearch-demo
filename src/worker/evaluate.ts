/** Combines at most two bounded query streams over the current catalog snapshot. */
import {
  mergeResults,
  type SearchResult,
  type SearchStats,
} from "asearch-wasm";
import { facetOptions } from "./options.ts";
import type { SearchContext } from "./search.ts";

/** Sums query work while counting the shared segment snapshot only once. */
function stats(results: readonly SearchResult[]): SearchStats {
  const first = results[0];
  if (!first) throw new Error("Missing query result");
  if (results.length === 1) return first.stats;
  const sum = (field: "blocks" | "earlyExitBlocks" | "reusedRows") =>
    results.reduce((total, result) => total + result.stats[field], 0);
  return {
    engine: results.every(
      (result) => result.stats.engine === first.stats.engine,
    )
      ? first.stats.engine
      : "mixed",
    segments: first.stats.segments,
    blocks: sum("blocks"),
    earlyExitBlocks: sum("earlyExitBlocks"),
    reusedRows: sum("reusedRows"),
  };
}

/** Keeps the primary session incremental and uses temporary WASM state for an alternative. */
export function evaluate(pattern: string, context: SearchContext) {
  const effective = context.policy?.normalize(pattern) ?? pattern;
  const patterns = [effective];
  const results = [context.session.update(effective)];

  const alternative = context.policy?.romanize(effective);
  if (alternative !== undefined) {
    patterns.push(alternative);
    results.push(context.root.search(alternative, facetOptions));
  }

  if (
    results.some(
      (result) =>
        !result.totals ||
        Array.from(result.totals).reduce((sum, value) => sum + value, 0) !==
          result.length,
    )
  )
    throw new Error("Incomplete facet search results");

  const hits = mergeResults(results, facetOptions.limit * results.length);
  return { hits, patterns, stats: stats(results) };
}
