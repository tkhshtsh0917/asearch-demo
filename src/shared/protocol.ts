import type { SearchStats } from "asearch-wasm";
export type Mode = "corpus" | "intent";
export type Request =
  | { kind: "init"; base: string }
  | { kind: "query"; id: number; pattern: string; mode: Mode }
  | { kind: "advance" };
export interface Row {
  key: number;
  text: string;
  title: string;
  url: string;
  level: number;
  spans: [number, number][];
}
export type Response =
  | { kind: "boot" }
  | {
      kind: "state";
      stage: number;
      count: number;
      busy: boolean;
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
