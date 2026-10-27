/** Coordinates bounded ingress and cooperative Rust tasks without exposing numeric handles. */
import { copyView } from "./bytes.ts";
import type {
  Artifact,
  Manifest,
  PreparedSnapshot,
  RawModule,
  RawStore,
  SearchResult,
  SnapshotInfo,
} from "./types.ts";

const turn = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
export class VectorClient {
  private readonly handles = new WeakMap<object, number>();
  private readonly prepared = new Map<number, PreparedSnapshot>();
  private preparing = false;
  private searching = false;
  private closed = false;
  private readonly native: RawStore;
  private readonly memory: WebAssembly.Memory;
  private readonly maxArtifact: number;

  private constructor(
    native: RawStore,
    memory: WebAssembly.Memory,
    expanded: boolean,
  ) {
    this.native = native;
    this.memory = memory;
    this.maxArtifact = (expanded ? 128 : 32) * 1024 * 1024;
  }
  static async create(moduleURL: URL, wasmURL: URL, expanded = false) {
    const api = (await import(/* @vite-ignore */ moduleURL.href)) as RawModule;
    const { memory } = await api.default({ module_or_path: wasmURL });
    if (api.abi_version() !== 1) throw new Error("Unsupported vector ABI");
    return new VectorClient(new api.BrowserStore(expanded), memory, expanded);
  }
  private assertOpen() {
    if (this.closed) throw new Error("Vector client disposed");
  }
  private id(handle: PreparedSnapshot) {
    this.assertOpen();
    const id = this.handles.get(handle);
    if (id === undefined)
      throw new TypeError("Foreign or released snapshot handle");
    return id;
  }
  private upload(
    bytes: Uint8Array<ArrayBuffer>,
    append: (size: number) => void,
  ) {
    const capacity = this.native.upload_capacity();
    for (let offset = 0; offset < bytes.length; offset += capacity) {
      const count = Math.min(capacity, bytes.length - offset);
      const destination = new Uint8Array(
        this.memory.buffer,
        this.native.upload_pointer(),
        count,
      );
      Uint8Array.prototype.set.call(
        destination,
        new Uint8Array(bytes.buffer, bytes.byteOffset + offset, count),
      );
      append(count);
    }
  }
  private input(kind: number, bytes: Uint8Array<ArrayBuffer>) {
    this.native.begin_input(kind, bytes.length);
    try {
      this.upload(bytes, (size) => this.native.append_input(size));
      this.native.finish_input();
    } catch (error) {
      this.native.cancel_input();
      throw error;
    }
  }
  async prepare(
    bytes: Uint8Array,
    resolve: (artifact: Artifact, index: number) => AsyncIterable<Uint8Array>,
    signal?: AbortSignal,
  ): Promise<PreparedSnapshot> {
    this.assertOpen();
    if (this.preparing) throw new Error("Preparation busy");
    this.preparing = true;
    try {
      const owned = copyView(
        bytes,
        "Uint8Array",
        128 * 1024,
        this.memory.buffer,
      );
      this.input(1, owned);
      const manifest = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(owned),
      ) as Manifest;
      while (true) {
        this.assertOpen();
        signal?.throwIfAborted();
        const index = this.native.next_artifact();
        if (index >= 0) {
          const entry = manifest.artifacts[index];
          if (!entry) throw new Error("Missing artifact entry");
          const length = Number(BigInt(entry.bytes));
          if (!Number.isSafeInteger(length) || length > this.maxArtifact)
            throw new RangeError("Artifact bytes");
          this.native.begin_artifact();
          let received = 0;
          for await (const source of resolve(entry, index)) {
            this.assertOpen();
            signal?.throwIfAborted();
            const chunk = copyView(
              source,
              "Uint8Array",
              65536,
              this.memory.buffer,
            );
            received += chunk.length;
            if (received > length)
              throw new RangeError("Decoded artifact limit");
            this.upload(chunk, (size) => this.native.append_artifact(size));
          }
          if (received !== length) throw new Error("Truncated artifact");
          this.native.seal_artifact();
        }
        if (this.native.step_prepare()) break;
        await turn();
      }
      const id = this.native.finish_prepare();
      const existing = this.prepared.get(id);
      if (existing) return existing;
      const handle = Object.freeze(
        JSON.parse(this.native.snapshot_info(id)) as SnapshotInfo,
      ) as PreparedSnapshot;
      this.handles.set(handle, id);
      this.prepared.set(id, handle);
      return handle;
    } catch (error) {
      if (!this.closed) this.native.cancel_prepare();
      throw error;
    } finally {
      this.preparing = false;
    }
  }
  adopt(handle: PreparedSnapshot) {
    this.native.adopt(this.id(handle));
  }
  release(handle: PreparedSnapshot) {
    const id = this.id(handle);
    this.native.release(id);
    this.handles.delete(handle);
    this.prepared.delete(id);
  }

  async search(
    handle: PreparedSnapshot,
    vector: Float32Array,
    k = 10,
    allowed?: Uint32Array,
    signal?: AbortSignal,
  ): Promise<SearchResult> {
    const id = this.id(handle);
    if (this.searching) throw new Error("Search busy");
    if (typeof k !== "number" || !Number.isInteger(k) || k < 0 || k > 100)
      throw new RangeError("Top-k range");
    this.searching = true;
    try {
      const query = new Float32Array(
        copyView(vector, "Float32Array", 4096 * 4, this.memory.buffer).buffer,
      );
      if (!query.every(Number.isFinite)) throw new TypeError("Nonfinite query");
      const ids =
        allowed === undefined
          ? null
          : new Uint32Array(
              copyView(allowed, "Uint32Array", 100_000 * 4, this.memory.buffer)
                .buffer,
            );
      const bytes = new TextEncoder().encode(
        JSON.stringify({
          handle: id,
          space: handle.space,
          revision: handle.revision,
          k,
          query: Array.from(query),
          allowed_ids: ids === null ? null : Array.from(ids),
        }),
      );
      this.input(2, bytes);
      while (true) {
        this.assertOpen();
        signal?.throwIfAborted();
        if (this.native.step_search()) break;
        await turn();
      }
      return JSON.parse(this.native.finish_search()) as SearchResult;
    } catch (error) {
      if (!this.closed) this.native.cancel_search();
      throw error;
    } finally {
      this.searching = false;
    }
  }
  resources() {
    this.assertOpen();
    return {
      ...JSON.parse(this.native.resources()),
      linear_memory_bytes: this.memory.buffer.byteLength,
    };
  }
  dispose() {
    if (this.closed) return;
    this.closed = true;
    this.native.cancel_search();
    this.native.cancel_prepare();
    this.native.cancel_input();
    this.native.free();
    this.prepared.clear();
  }
}
