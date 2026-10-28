/** Stable browser-facing identities and exact-search result metadata. */
export type SnapshotInfo = Readonly<{
  snapshot: string;
  space: string;
  revision: string;
  generation: string;
  live_ids: string;
  rows: number;
}>;
declare const prepared: unique symbol;
export type PreparedSnapshot = SnapshotInfo & { readonly [prepared]: true };
export type Candidate = { id: number; distance: number };
export type SearchResult = {
  candidates: Candidate[];
  snapshot: string;
  space: string;
  revision: string;
  algorithm: "flat-exact";
  kernel: "scalar-f64-v1";
  requested_k: number;
  evaluations: number;
  coordinates: number;
  eligible: number | null;
};
export type Artifact = {
  sha256: string;
  bytes: string;
  generation: string;
  revision: string;
  parent: string | null;
  url: string;
};
export type Manifest = {
  schema: 1;
  space: string;
  revision: string;
  generation: string;
  artifacts: Artifact[];
};

export interface RawStore {
  free(): void;
  upload_pointer(): number;
  upload_capacity(): number;
  begin_input(kind: number, length: number): void;
  append_input(length: number): void;
  finish_input(): void;
  cancel_input(): void;
  next_artifact(): number;
  begin_artifact(): void;
  append_artifact(length: number): void;
  seal_artifact(): void;
  step_prepare(): boolean;
  finish_prepare(): number;
  cancel_prepare(): void;
  adopt(handle: number): void;
  release(handle: number): void;
  snapshot_info(handle: number): string;
  step_search(): boolean;
  finish_search(): string;
  cancel_search(): void;
  resources(): string;
}
export type RawModule = {
  default(options: {
    module_or_path: URL;
  }): Promise<{ memory: WebAssembly.Memory }>;
  abi_version(): number;
  BrowserStore: new (expanded: boolean) => RawStore;
};
