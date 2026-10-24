/** Validates native analyzer output before it reaches the ASIX builder. */
import type { Doc } from "asearch-wasm";
import type { Question } from "../../src/shared/catalog.ts";

export function documents(rows: Question[], analyses: unknown): Doc[] {
  if (!Array.isArray(analyses) || analyses.length !== rows.length)
    throw new Error("Analysis record count mismatch");
  return rows.map((row, index) => {
    const entry = analyses[index] as Doc | undefined;
    if (
      !entry ||
      entry.key !== row.key ||
      entry.order !== row.key ||
      !Array.isArray(entry.texts) ||
      entry.texts[0] !== row.text ||
      entry.texts.some(
        (text) =>
          typeof text !== "string" || !text.trim() || text.length > 65535,
      )
    )
      throw new Error("Invalid native analysis record");
    return { key: entry.key, order: entry.order, texts: entry.texts };
  });
}
