/** Defines typed commands and responses exchanged by the UI and search Worker. */
import type { SearchStats } from "asearch-wasm";
import type { ChangeKind, ChangeSummary } from "./changes.ts";
import type { Facets, SearchFilters } from "./facets.ts";
export type Request =
  | { kind: "init"; base: string }
  | { kind: "query"; id: number; pattern: string; filters?: SearchFilters }
  | { kind: "advance" }
  | { kind: "restore" };
export interface Row {
  key: number;
  text: string;
  title: string;
  url: string;
  level: number;
  spans: [number, number][];
  alias?: { text: string; spans: [number, number][] };
  change?: ChangeKind;
  snippet?: string;
  browsing?: boolean;
}
export type Response =
  | { kind: "boot" }
  | {
      kind: "state";
      stage: number;
      epoch: number;
      pending: "advance" | "restore" | null;
      count: number;
      busy: boolean;
      segments: number;
      updates: ChangeSummary;
      creator: string;
      changes: string;
    }
  | {
      kind: "results";
      id: number;
      epoch: number;
      rows: Row[];
      total: number;
      facets: Facets;
      /** False when overlapping truncated query streams establish only a lower bound. */
      totalIsExact?: boolean;
      elapsed: number;
      stats: SearchStats | null;
    }
  | ({ kind: "error"; message: string; fatal: boolean } & (
      | { id: number; epoch: number }
      | { id?: never; epoch?: never }
    ));
