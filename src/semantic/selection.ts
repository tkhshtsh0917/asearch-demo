/** Applies full-catalog facets and cross-group exclusions before vector top-k. */
import type { Question } from "../shared/catalog.ts";
import type { ChangeKind } from "../shared/changes.ts";
import { searchFilters } from "../shared/facets.ts";

export function eligibleIds(
  rows: readonly Question[],
  changes: ReadonlyMap<number, ChangeKind>,
  filters: unknown,
  exclude: readonly number[],
): Uint32Array | undefined {
  const selected = searchFilters(filters);
  if (
    exclude.length > 100 ||
    exclude.some((id) => !Number.isInteger(id) || id < 0 || id > 0xffffffff)
  )
    throw new Error("Invalid result exclusions");
  if (!selected.articles.length && !selected.changes.length && !exclude.length)
    return undefined;
  const articles = new Set(selected.articles),
    kinds = new Set(selected.changes),
    excluded = new Set(exclude);
  return Uint32Array.from(
    rows
      .filter(
        (q) =>
          !excluded.has(q.key) &&
          (!articles.size || articles.has(q.title)) &&
          (!kinds.size || kinds.has(changes.get(q.key) ?? "unchanged")),
      )
      .map((q) => q.key)
      .sort((a, b) => a - b),
  );
}
