/** Defines typed commands and responses exchanged by the UI and search Worker. */
import type { SearchStats } from "asearch-wasm";
import type { ChangeKind, ChangeSummary } from "./changes.ts";
export type Mode = "corpus" | "intent";
export type Request =
  | { kind: "init"; base: string }
  | { kind: "query"; id: number; pattern: string; mode: Mode }
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
      mode: Mode;
      epoch: number;
      rows: Row[];
      total: number;
      elapsed: number;
      stats: SearchStats | null;
    }
  | { kind: "error"; message: string; fatal: boolean; id?: number };
