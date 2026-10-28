/** Exposes the exact asset consumer to browser conformance tests. */
import { VectorClient } from "./client.ts";
import { readyResources } from "./fixtures/ready.ts";
import type { Artifact, PreparedSnapshot, RawModule } from "./types.ts";

async function create(expanded = false) {
  return VectorClient.create(
    new URL("/bindings/vectide_wasm.js", location.href),
    new URL("/bindings/vectide_wasm_bg.wasm", location.href),
    expanded,
  );
}
async function prepare(client: VectorClient, name: string) {
  const bytes = new Uint8Array(
    await (await fetch(`/fixtures/${name}.json`)).arrayBuffer(),
  );
  return client.prepare(bytes, async function* (artifact: Artifact) {
    const response = await fetch(`/fixtures/${artifact.url}`);
    if (!response.ok || !response.body) throw new Error("Fixture unavailable");
    for await (const chunk of response.body) {
      for (let i = 0; i < chunk.length; i += 65536)
        yield chunk.subarray(i, i + 65536);
    }
  });
}
export const harness = {
  async raw(profile: unknown = false) {
    const moduleURL = new URL("/bindings/vectide_wasm.js", location.href);
    const api = (await import(/* @vite-ignore */ moduleURL.href)) as RawModule;
    const { memory } = await api.default({
      module_or_path: new URL("/bindings/vectide_wasm_bg.wasm", location.href),
    });
    return { native: new api.BrowserStore(profile as boolean), memory };
  },
  create,
  prepare,
  async readyResources() {
    const { native, memory } = await harness.raw();
    try {
      return await readyResources(native, memory);
    } finally {
      native.free();
    }
  },
  query: (c: VectorClient, h: PreparedSnapshot, ids?: number[]) =>
    c.search(
      h,
      new Float32Array([1, 0, 0]),
      10,
      ids ? new Uint32Array(ids) : undefined,
    ),
};
export type Harness = typeof harness;
Object.assign(globalThis, { vectorHarness: harness });
