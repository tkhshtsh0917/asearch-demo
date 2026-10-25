/** Applies bounded query policy, invokes WASM and returns display-only results. */
import type { AsearchIndex, IntentIndex, SearchSession } from "asearch-wasm";
import type { Question } from "../shared/catalog.ts";
import type { ChangeKind } from "../shared/changes.ts";
import type { Request, Response } from "../shared/protocol.ts";
import type { QueryPolicy } from "../shared/query.ts";
import { evaluate } from "./evaluate.ts";
import { searchOptions } from "./options.ts";
import { questionRow, row } from "./rows.ts";

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
  const { id, pattern, mode, title } = request;
  if (
    title !== undefined &&
    (typeof title !== "string" || title.length > 65535)
  )
    throw new Error("Invalid article filter");
  const filtering = mode === "corpus" && title !== undefined;
  const started = performance.now();
  if (!pattern.trim()) {
    context.session.reset();
    const questions = filtering
      ? Array.from(context.questions.values())
          .filter((question) => question.title === title)
          .sort((a, b) => a.key - b.key)
      : [];
    return {
      kind: "results",
      id,
      mode,
      epoch,
      rows: questions
        .slice(0, searchOptions.limit)
        .map((source) => questionRow(source, context.changes?.get(source.key))),
      total: questions.length,
      elapsed: filtering ? performance.now() - started : 0,
      stats: null,
    };
  }
  const { hits, patterns, total, totalIsExact, stats } = evaluate(
    pattern,
    mode,
    context,
    title,
  );
  const indexes = Array.from(hits.ids.keys()).filter(
    (index) =>
      !filtering ||
      context.questions.get(hits.ids[index] ?? -1)?.title === title,
  );
  const rows = [];
  for (const i of indexes.slice(0, searchOptions.limit)) {
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
    total: filtering ? indexes.length : total,
    totalIsExact: filtering || totalIsExact,
    elapsed: performance.now() - started,
    stats,
  };
}
