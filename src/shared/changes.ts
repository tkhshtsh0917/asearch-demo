/** Describes visible catalog changes relative to the initial publication. */
import type { Question } from "./catalog.ts";

export type ChangeKind = "added" | "updated";
export interface ChangeSummary {
  added: number;
  updated: number;
  removed: number;
}
export interface CatalogChanges {
  byKey: ReadonlyMap<number, ChangeKind>;
  summary: ChangeSummary;
}

/** Compares full display records; unchanged keys and removed records receive no result badge. */
export function catalogChanges(
  before: ReadonlyMap<number, Question>,
  after: ReadonlyMap<number, Question>,
): CatalogChanges {
  const byKey = new Map<number, ChangeKind>();
  const summary: ChangeSummary = { added: 0, updated: 0, removed: 0 };
  for (const [key, value] of after) {
    const original = before.get(key);
    if (!original) {
      byKey.set(key, "added");
      summary.added++;
    } else if (
      original.text !== value.text ||
      original.title !== value.title ||
      original.url !== value.url ||
      (original.snippet ?? "") !== (value.snippet ?? "")
    ) {
      byKey.set(key, "updated");
      summary.updated++;
    }
  }
  for (const key of before.keys()) {
    if (!after.has(key)) summary.removed++;
  }
  return { byKey, summary };
}
