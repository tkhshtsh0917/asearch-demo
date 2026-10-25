/** Maps a WASM hit to catalog text and independently aligned auxiliary text. */

import type { Question } from "../shared/catalog.ts";
import type { ChangeKind } from "../shared/changes.ts";
import type { Row } from "../shared/protocol.ts";
import { searchOptions } from "./options.ts";
import type { SearchContext } from "./search.ts";

/** Creates display-only rows for browsing an article without a keyword. */
export function questionRow(source: Question, change?: ChangeKind): Row {
  return {
    browsing: true,
    key: source.key,
    text: source.text,
    title: source.title,
    url: source.url,
    spans: [],
    level: 0,
    ...(source.snippet ? { snippet: source.snippet } : {}),
    ...(change ? { change } : {}),
  };
}

export function row(
  context: SearchContext,
  effective: string,
  key: number,
  ref: number,
  level: number,
): Row {
  const source = context.questions.get(key);
  if (!source) throw new Error("Missing result question");
  let text = source.text,
    spans: [number, number][] = [];
  let alias: Row["alias"];

  try {
    const detail = context.root.explain(ref, effective, searchOptions);
    if (detail) {
      if (detail.text !== text) {
        alias = { text: detail.text, spans: detail.spans };
      } else {
        text = detail.text;
        spans = detail.spans;
      }
    }
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !("code" in error) ||
      error.code !== "RESOURCE_LIMIT"
    )
      throw error;
  }

  const change = context.changes?.get(key);

  return {
    key,
    text,
    spans,
    level,
    ...(alias ? { alias } : {}),
    ...(change ? { change } : {}),
    ...(source.snippet ? { snippet: source.snippet } : {}),
    title: source.title,
    url: source.url,
  };
}
