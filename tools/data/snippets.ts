/** Prepares bounded source excerpts independently of the searchable question corpus. */
import type { Question } from "../../src/shared/catalog.ts";
import { MAX_SNIPPET_CODE_POINTS } from "../../src/shared/snippets.ts";

export interface Snippet {
  key: number;
  snippet: string;
}

/** Collapses whitespace and limits Unicode code points without splitting surrogate pairs. */
export function excerpt(value: unknown): string {
  if (typeof value !== "string" || value.length > 1024 * 1024)
    throw new Error("Invalid source passage");
  const text = value.replace(/[\p{Cc}\s]+/gu, " ").trim();
  const points = Array.from(text);
  return points.length <= MAX_SNIPPET_CODE_POINTS
    ? text
    : `${points.slice(0, MAX_SNIPPET_CODE_POINTS - 1).join("")}…`;
}

export function snippetsFromRows(
  rows: Record<string, unknown>[],
  questions: readonly Pick<Question, "key">[],
): Snippet[] {
  if (rows.length !== questions.length)
    throw new Error("Snippet row count mismatch");
  return rows.map((row, index) => {
    const question = questions[index];
    if (!question) throw new Error("Missing snippet key");
    return { key: question.key, snippet: excerpt(row.text) };
  });
}

/** Requires a one-to-one key join so display text cannot attach to a different question. */
export function attachSnippets(
  questions: Question[],
  values: unknown,
): Question[] {
  if (!Array.isArray(values) || values.length !== questions.length)
    throw new Error("Snippet row count mismatch");
  const byKey = new Map<number, string>();
  for (const row of values) {
    if (
      !row ||
      !Number.isInteger(row.key) ||
      byKey.has(row.key) ||
      typeof row.snippet !== "string" ||
      Array.from(row.snippet).length > MAX_SNIPPET_CODE_POINTS
    )
      throw new Error("Invalid snippet record");
    byKey.set(row.key, row.snippet);
  }
  return questions.map((question) => {
    const snippet = byKey.get(question.key);
    if (snippet === undefined) throw new Error("Missing snippet key");
    return { ...question, snippet };
  });
}

export function serializeSnippets(snippets: Snippet[]): string {
  return `${snippets.map((row) => JSON.stringify(row)).join("\n")}\n`;
}
