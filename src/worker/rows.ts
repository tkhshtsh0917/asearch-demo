/** Maps a WASM hit to catalog text and independently aligned auxiliary text. */

import { intents } from "../shared/intents.ts";
import type { Mode, Row } from "../shared/protocol.ts";
import { searchOptions } from "./options.ts";
import type { SearchContext } from "./search.ts";

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
