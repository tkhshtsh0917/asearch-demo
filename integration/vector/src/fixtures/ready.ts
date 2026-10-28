/** Checks raw-ABI ownership while a completed preparation temporarily has no handle. */
import type { Manifest, RawStore } from "../types.ts";

export async function readyResources(
  native: RawStore,
  memory: WebAssembly.Memory,
) {
  const manifest = new Uint8Array(
    await (await fetch("/fixtures/base.json")).arrayBuffer(),
  );
  const parsed = JSON.parse(new TextDecoder().decode(manifest)) as Manifest;
  const resources = () =>
    JSON.parse(native.resources()) as {
      owned_bytes: number;
      staging_reserved_bytes: number;
      handles: number;
    };
  const upload = (bytes: Uint8Array, append: (length: number) => void) => {
    for (let offset = 0; offset < bytes.length; offset += 65536) {
      const chunk = bytes.subarray(offset, offset + 65536);
      new Uint8Array(memory.buffer, native.upload_pointer(), chunk.length).set(
        chunk,
      );
      append(chunk.length);
    }
  };
  const begin = () => {
    native.begin_input(1, manifest.length);
    upload(manifest, (length) => native.append_input(length));
    native.finish_input();
  };
  const empty = resources().owned_bytes;

  begin();
  for (let steps = 0; ; steps++) {
    if (steps > 10000) throw new Error("Ready fixture step limit");
    const index = native.next_artifact();
    if (index >= 0) {
      const artifact = parsed.artifacts[index];
      if (!artifact) throw new Error("Missing ready fixture artifact");
      const bytes = new Uint8Array(
        await (await fetch(`/fixtures/${artifact.url}`)).arrayBuffer(),
      );
      native.begin_artifact();
      upload(bytes, (length) => native.append_artifact(length));
      native.seal_artifact();
    }
    if (native.step_prepare()) break;
  }
  const ready = resources();
  if (ready.owned_bytes <= empty || ready.staging_reserved_bytes !== 0)
    throw new Error("Completed preparation did not transfer its reservation");
  const original = native.finish_prepare(),
    info = native.snapshot_info(original);
  if (resources().owned_bytes !== ready.owned_bytes)
    throw new Error("Handle creation changed retained ownership");

  begin();
  native.release(original);
  const retained = resources();
  if (
    retained.handles !== 0 ||
    retained.owned_bytes !== ready.owned_bytes ||
    retained.staging_reserved_bytes !== 0
  )
    throw new Error("Ready snapshot disappeared from the ownership ledger");
  if (!native.step_prepare())
    throw new Error("Cached preparation was not ready");
  const restored = native.finish_prepare();
  if (restored === original || native.snapshot_info(restored) !== info)
    throw new Error(
      "Ready snapshot restoration changed identity or reused a released handle",
    );

  begin();
  native.release(restored);
  native.cancel_prepare();
  if (resources().owned_bytes !== empty)
    throw new Error("Cancelled ready snapshot retained allocations");
  return {
    empty,
    ready: ready.owned_bytes,
    retained: retained.owned_bytes,
    cancelled: resources().owned_bytes,
  };
}
