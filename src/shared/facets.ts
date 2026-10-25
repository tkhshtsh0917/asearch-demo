/** Builds article facets and selects a bounded, searchable option list. */
import type { Question } from "./catalog.ts";

export interface ArticleFacet {
  title: string;
  count: number;
}

export function articleFacets(
  questions: ReadonlyMap<number, Question>,
): ArticleFacet[] {
  const counts = new Map<string, number>();
  for (const question of questions.values())
    counts.set(question.title, (counts.get(question.title) ?? 0) + 1);
  return Array.from(counts, ([title, count]) => ({ title, count })).sort(
    (a, b) => b.count - a.count || a.title.localeCompare(b.title, "ja"),
  );
}

/** Counts describe the adopted catalog, not only the currently displayed top results. */
export function articleOptions(
  facets: readonly ArticleFacet[],
  filter: string,
  selected: string | undefined,
) {
  const query = filter.normalize("NFKC").toLocaleLowerCase("ja");
  const matches = facets
    .flatMap((facet, order) => {
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
  const options = matches.slice(0, 50).map((match) => match.facet);
  if (
    selected !== undefined &&
    !options.some((facet) => facet.title === selected)
  )
    options.unshift(
      facets.find((facet) => facet.title === selected) ?? {
        title: selected,
        count: 0,
      },
    );
  return { options, matches: matches.length };
}
