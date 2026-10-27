/** Carries committed query identities and bounded semantic results between Workers and UI. */
import type { Question } from "../shared/catalog.ts";
import type { ChangeKind } from "../shared/changes.ts";
import type { SearchFilters, SemanticAvailability } from "../shared/facets.ts";
import type { SemanticPin } from "./identity.ts";
export interface SemanticContext {
  stage: number;
  catalogSha256: string;
  lexicalManifest: string;
  pin: SemanticPin;
}
export type SemanticRequest =
  | {
      kind: "query";
      token: number;
      base: string;
      context: SemanticContext;
      text: string;
      filters: SearchFilters;
      exclude: number[];
    }
  | { kind: "cancel" };
export type SemanticReply =
  | {
      kind: "catalog";
      token: number;
      stage: number;
      catalogSha256: string;
      available: SemanticAvailability;
    }
  | {
      kind: "result";
      token: number;
      rows: (Question & { distance: number; change?: ChangeKind })[];
      elapsed: number;
      snapshot: string;
      stage: number;
      catalogSha256: string;
    }
  | { kind: "error"; token: number; message: string };
