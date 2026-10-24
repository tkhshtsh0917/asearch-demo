/** Applies bounded query policy, invokes WASM and returns display-only results. */
import type {
  AsearchIndex,
  IntentIndex,
  SearchResult,
  SearchSession,
} from "asearch-wasm";
import type { Question } from "../shared/catalog.ts";
import type { ChangeKind } from "../shared/changes.ts";
import type { Request, Response } from "../shared/protocol.ts";
import type { QueryPolicy } from "../shared/query.ts";
import { searchOptions } from "./options.ts";
import { row } from "./rows.ts";

export interface SearchContext {
  root: AsearchIndex;
  session: SearchSession;
  intent: IntentIndex;
  questions: ReadonlyMap<number, Question>;
  changes?: ReadonlyMap<number, ChangeKind>;
  policy?: QueryPolicy;
}

/** Canonicalizes known words, preserving literal hits ahead of kana fallback. */
function evaluate(
  pattern: string,
  context: SearchContext,
): { result: SearchResult; effective: string } {
  let effective = context.policy?.normalize(pattern) ?? pattern;
  let result = context.session.update(effective);
  if (result.length === 0) {
    const fallback = context.policy?.fallback(effective);
    if (fallback) {
      effective = fallback;
      result = context.session.update(effective);
    }
  }
  return { result, effective };
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
  const { result, effective } =
    mode === "corpus"
      ? evaluate(pattern, context)
      : {
          result: context.intent.search(pattern, searchOptions),
          effective: pattern,
        };
  const rows = [];
  for (let i = 0; i < result.length; i++) {
    const key = result.ids[i],
      ref = result.refs[i],
      level = result.levels[i];
    if (key === undefined || ref === undefined || level === undefined)
      throw new Error("Invalid search result");
    rows.push(row(context, mode, effective, key, ref, level));
  }
  return {
    kind: "results",
    id,
    mode,
    epoch,
    rows,
    total: result.totals
      ? Array.from(result.totals).reduce((sum, n) => sum + n, 0)
      : result.length,
    elapsed: performance.now() - started,
    stats: result.stats,
  };
}
