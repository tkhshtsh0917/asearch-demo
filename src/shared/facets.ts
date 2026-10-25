/** Defines bounded facet selections and searchable article options. */

export const MAX_SELECTED_ARTICLES = 50;
export const changeKinds = ["unchanged", "added", "updated"] as const;
export type ChangeFilter = (typeof changeKinds)[number];
export interface SearchFilters {
  articles: readonly string[];
  changes: readonly ChangeFilter[];
}
export interface ArticleFacet {
  title: string;
  count: number;
}
export interface Facets {
  articles: ArticleFacet[];
  changes: { kind: ChangeFilter; count: number }[];
}

/** Rejects malformed or unbounded selections before browsing or matching. */
export function searchFilters(value: unknown): SearchFilters {
  if (value === undefined) return { articles: [], changes: [] };
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid search filters");
  const input = value as SearchFilters;
  const { articles, changes } = input;
  if (
    Object.keys(input).some((key) => key !== "articles" && key !== "changes") ||
    !Array.isArray(articles) ||
    articles.length > MAX_SELECTED_ARTICLES ||
    articles.some(
      (title) => typeof title !== "string" || title.length > 65535,
    ) ||
    new Set(articles).size !== articles.length ||
    !Array.isArray(changes) ||
    changes.length > changeKinds.length ||
    changes.some((kind) => !changeKinds.includes(kind)) ||
    new Set(changes).size !== changes.length
  )
    throw new Error("Invalid search filters");
  return { articles: [...articles], changes: [...changes] };
}

export function sortedArticles(
  counts: ReadonlyMap<string, number>,
): ArticleFacet[] {
  return Array.from(counts, ([title, count]) => ({ title, count })).sort(
    (a, b) => b.count - a.count || a.title.localeCompare(b.title, "ja"),
  );
}

/** Retains every selection, including zero-count articles and options outside the first fifty. */
export function articleOptions(
  facets: readonly ArticleFacet[],
  filter: string,
  selected: readonly string[],
) {
  const query = filter.normalize("NFKC").toLocaleLowerCase("ja");
  const retained = new Map(
    selected.map((title) => [title, { title, count: 0 }]),
  );
  const matches = facets
    .flatMap((facet, order) => {
      if (retained.has(facet.title)) retained.set(facet.title, facet);
      const title = facet.title.normalize("NFKC").toLocaleLowerCase("ja");
      return title.includes(query)
        ? [
            {
              facet,
              order,
              rank:
                !query || title === query ? 0 : title.startsWith(query) ? 1 : 2,
            },
          ]
        : [];
    })
    .sort((a, b) => a.rank - b.rank || a.order - b.order);
  const options = [...retained.values()];
  options.push(
    ...matches
      .filter(({ facet }) => !retained.has(facet.title))
      .slice(0, 50)
      .map(({ facet }) => facet),
  );
  return { options, matches: matches.length };
}
