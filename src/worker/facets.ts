/** Refines complete query matches and counts each facet with its own selections excluded. */
import type { Question } from "../shared/catalog.ts";
import type { ChangeKind } from "../shared/changes.ts";
import {
  changeKinds,
  type Facets,
  type SearchFilters,
  sortedArticles,
} from "../shared/facets.ts";

export function refine(
  ids: Iterable<number>,
  questions: ReadonlyMap<number, Question>,
  changes: ReadonlyMap<number, ChangeKind> | undefined,
  filters: SearchFilters,
): { indexes: number[]; facets: Facets } {
  const articles = new Set(filters.articles),
    selectedChanges = new Set(filters.changes);
  const articleCounts = new Map<string, number>();
  const changeCounts = new Map(changeKinds.map((kind) => [kind, 0]));
  const indexes: number[] = [];
  let index = 0;
  for (const key of ids) {
    const question = questions.get(key);
    if (!question) throw new Error("Missing result question");
    const kind = changes?.get(key) ?? "unchanged";
    const inArticle = articles.size === 0 || articles.has(question.title);
    const inChanges = selectedChanges.size === 0 || selectedChanges.has(kind);
    if (inChanges)
      articleCounts.set(
        question.title,
        (articleCounts.get(question.title) ?? 0) + 1,
      );
    if (inArticle) changeCounts.set(kind, (changeCounts.get(kind) ?? 0) + 1);
    if (inArticle && inChanges) indexes.push(index);
    index++;
  }
  return {
    indexes,
    facets: {
      articles: sortedArticles(articleCounts),
      changes: changeKinds.map((kind) => ({
        kind,
        count: changeCounts.get(kind) ?? 0,
      })),
    },
  };
}
