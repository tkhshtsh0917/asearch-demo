/** Applies bounded query policy, invokes WASM and returns display-only results. */
import type { AsearchIndex, SearchSession } from "asearch-wasm";
import type { Question } from "../shared/catalog.ts";
import type { ChangeKind } from "../shared/changes.ts";
import { searchFilters } from "../shared/facets.ts";
import type { Request, Response } from "../shared/protocol.ts";
import type { QueryPolicy } from "../shared/query.ts";
import { evaluate } from "./evaluate.ts";
import { refine } from "./facets.ts";
import { searchOptions } from "./options.ts";
import { questionRow, row } from "./rows.ts";

export interface SearchContext {
  root: Pick<AsearchIndex, "search" | "explain">;
  /** Created with facetOptions so complete IDs precede facet counting and display top-N. */
  session: Pick<SearchSession, "update" | "reset">;
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
  const { id, pattern } = request;
  const filters = searchFilters(request.filters);
  const filtering = filters.articles.length > 0 || filters.changes.length > 0;
  const started = performance.now();
  if (!pattern.trim()) {
    context.session.reset();
    const ids = filtering
      ? Array.from(context.questions.keys()).sort((a, b) => a - b)
      : [];
    const { indexes, facets } = refine(
      ids,
      context.questions,
      context.changes,
      filters,
    );
    const questions = indexes.map((i) => {
      const question = context.questions.get(ids[i] ?? -1);
      if (!question) throw new Error("Missing result question");
      return question;
    });
    return {
      kind: "results",
      id,
      epoch,
      rows: questions
        .slice(0, searchOptions.limit)
        .map((source) => questionRow(source, context.changes?.get(source.key))),
      total: questions.length,
      facets,
      elapsed: filtering ? performance.now() - started : 0,
      stats: null,
    };
  }
  const { hits, patterns, stats } = evaluate(pattern, context);
  const { indexes, facets } = refine(
    hits.ids,
    context.questions,
    context.changes,
    filters,
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
    rows.push(row(context, effective, key, ref, level));
  }
  return {
    kind: "results",
    id,
    epoch,
    rows,
    total: indexes.length,
    totalIsExact: true,
    facets,
    elapsed: performance.now() - started,
    stats,
  };
}
