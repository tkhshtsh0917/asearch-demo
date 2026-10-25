/** Maps a WASM hit to catalog text and independently aligned auxiliary text. */

import type { Question } from "../shared/catalog.ts";
import type { ChangeKind } from "../shared/changes.ts";
import { intents } from "../shared/intents.ts";
import type { Mode, Row } from "../shared/protocol.ts";
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
  mode: Mode,
  effective: string,
  key: number,
  ref: number,
  level: number,
): Row {
  const source = context.questions.get(key),
    entry = intents.find((entry) => entry.key === key);
  let text = mode === "corpus" ? (source?.text ?? "") : (entry?.expr ?? ""),
    spans: [number, number][] = [];
  let alias: Row["alias"];

  try {
    const detail = (mode === "corpus" ? context.root : context.intent).explain(
      ref,
      effective,
      searchOptions,
    );
    if (detail) {
      if (mode === "corpus" && detail.text !== text) {
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

  const change = mode === "corpus" ? context.changes?.get(key) : undefined;

  return {
    key,
    text,
    spans,
    level,
    ...(alias ? { alias } : {}),
    ...(change ? { change } : {}),
    ...(mode === "corpus" && source?.snippet
      ? { snippet: source.snippet }
      : {}),
    title:
      mode === "corpus" ? (source?.title ?? "") : "意図表現から選ばれた展開",
    url: mode === "corpus" ? (source?.url ?? "") : "",
  };
}
