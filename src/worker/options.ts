/** Shared query settings for matching and explanation. */

import { MatchMode } from "asearch-wasm";
import { MAX_CATALOG_QUESTIONS } from "../shared/catalog.ts";

export const searchOptions = {
  mode: MatchMode.WildcardSpace,
  limit: 20,
  countTotal: true,
} as const;
export const corpusOptions = { ...searchOptions, ranking: "position" } as const;

/** Complete IDs are required for keyword-dependent facet counts before display top-N. */
export const facetOptions = {
  ...corpusOptions,
  limit: MAX_CATALOG_QUESTIONS,
} as const;
