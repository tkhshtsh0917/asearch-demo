/** Applies bounded query policy, invokes WASM and returns display-only results. */
import type { AsearchIndex, IntentIndex, SearchSession } from "asearch-wasm";
import type { Question } from "../shared/catalog.ts";
import type { ChangeKind } from "../shared/changes.ts";
import type { Request, Response } from "../shared/protocol.ts";
import type { QueryPolicy } from "../shared/query.ts";
import { evaluate } from "./evaluate.ts";
import { searchOptions } from "./options.ts";
import { row } from "./rows.ts";

export interface SearchContext {
  root: Pick<AsearchIndex, "search" | "explain">;
  /** Created with corpusOptions, including positional ranking and total counts. */
  session: Pick<SearchSession, "update" | "reset">;
  intent: Pick<IntentIndex, "search" | "explain">;
  questions: ReadonlyMap<number, Question>;
  changes?: ReadonlyMap<number, ChangeKind>;
  policy?: QueryPolicy;
}

/** Searches one request; blank input clears reusable state without invoking matching. */
export function search(
  request: Extract<Request, { kind: "query" }>,
  epoch: number,
  context: SearchContext,
): Response {
  const { id, pattern, mode } = request;
  const started = performance.now();
  if (!pattern.trim()) {
    context.session.reset();
    return {
      kind: "results",
      id,
      mode,
      epoch,
      rows: [],
      total: 0,
      elapsed: 0,
      stats: null,
    };
  }
  const { hits, patterns, total, totalIsExact, stats } = evaluate(
    pattern,
    mode,
    context,
  );
  const rows = [];
  for (let i = 0; i < Math.min(hits.ids.length, searchOptions.limit); i++) {
    const key = hits.ids[i],
      ref = hits.refs[i],
      level = hits.levels[i],
      effective = patterns[hits.parts[i] ?? -1];
    if (
      key === undefined ||
      ref === undefined ||
      level === undefined ||
      effective === undefined
    )
      throw new Error("Invalid search result");
    rows.push(row(context, mode, effective, key, ref, level));
  }
  return {
    kind: "results",
    id,
    mode,
    epoch,
    rows,
    total,
    totalIsExact,
    elapsed: performance.now() - started,
    stats,
  };
}
