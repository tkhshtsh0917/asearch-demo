/** Converts bounded WASM search results and explanations into display-only rows. */
import {
  type AsearchIndex,
  type IntentIndex,
  MatchMode,
  type SearchResult,
  type SearchSession,
} from "asearch-wasm";
import type { Question } from "../shared/catalog.ts";
import type { ChangeKind } from "../shared/changes.ts";
import type { Mode, Response, Row } from "../shared/protocol.ts";

export const intents = [
  { key: 0, expr: "(電球|ライト)(を)?(交換|修理)(する)?" },
  { key: 1, expr: "日本(の)?(歴史|地理)" },
  { key: 2, expr: "(電車|列車)(の)?(時刻|時間)" },
];

export const searchOptions = {
  mode: MatchMode.WildcardSpace,
  limit: 20,
  countTotal: true,
} as const;

/** Searches the chosen index and maps explanations to safe UI rows within the query budget. */
export function search(
  id: number,
  pattern: string,
  mode: Mode,
  epoch: number,
  root: AsearchIndex,
  session: SearchSession,
  intent: IntentIndex,
  questions: Map<number, Question>,
  changes?: ReadonlyMap<number, ChangeKind>,
): Response {
  const started = performance.now();

  if (!pattern.trim()) {
    session.reset();
    return {
      kind: "results",
      id,
      mode,
      epoch,
      rows: [],
      total: 0,
      elapsed: 0,
      stats: null,
    };
  }

  const result: SearchResult =
    mode === "corpus"
      ? session.update(pattern)
      : intent.search(pattern, searchOptions);

  const rows: Row[] = [];
  for (let i = 0; i < result.length; i++) {
    const key = result.ids[i],
      ref = result.refs[i],
      level = result.levels[i];
    if (key === undefined || ref === undefined || level === undefined)
      throw new Error("Invalid search result");
    const source = questions.get(key),
      entry = intents.find((entry) => entry.key === key);
    let text = mode === "corpus" ? (source?.text ?? "") : (entry?.expr ?? ""),
      spans: [number, number][] = [];
    let alias: Row["alias"];
    try {
      const detail = (mode === "corpus" ? root : intent).explain(
        ref,
        pattern,
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
    const change = mode === "corpus" ? changes?.get(key) : undefined;
    rows.push({
      key,
      text,
      spans,
      level,
      ...(alias ? { alias } : {}),
      ...(change ? { change } : {}),
      title:
        mode === "corpus" ? (source?.title ?? "") : "意図表現から選ばれた展開",
      url: mode === "corpus" ? (source?.url ?? "") : "",
    });
  }
  return {
    kind: "results",
    id,
    mode,
    epoch,
    rows,
    total: result.totals
      ? Array.from(result.totals).reduce((sum, n) => sum + n, 0)
      : result.length,
    elapsed: performance.now() - started,
    stats: result.stats,
  };
}
