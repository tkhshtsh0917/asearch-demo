/** Shared query settings for matching and explanation. */
import { MatchMode } from "asearch-wasm";

export const searchOptions = {
  mode: MatchMode.WildcardSpace,
  limit: 20,
  countTotal: true,
} as const;
export const corpusOptions = { ...searchOptions, ranking: "position" } as const;
