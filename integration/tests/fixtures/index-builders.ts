import { indexConfig } from "../../packages/asearch-wasm/src/index-config.js";
import { flatten } from "../../packages/asearch-wasm/src/index-input.js";
import type {
  Doc,
  IndexOptions,
} from "../../packages/asearch-wasm/src/index-options.js";
import { buildFlat } from "./server.mjs";

const call = <T>(callback: () => T): T => callback();

import {
  fail,
  inputTypeError,
  integer,
} from "../../packages/asearch-wasm/src/index-validation.js";

/** Server-side builder without active-index query or reference allocations. */
export function buildIndex(
  docs: Iterable<Doc>,
  options?: IndexOptions,
): Uint8Array {
  return buildDelta(docs, [], options);
}

/** Builds one immutable server segment. Does not modify any active index. */
export function buildDelta(
  docs: Iterable<Doc>,
  tombstones: readonly number[],
  options?: IndexOptions,
): Uint8Array {
  const config = indexConfig(options);
  if (!Array.isArray(tombstones))
    throw inputTypeError("tombstones must be an array");
  const count = integer(tombstones.length, "tombstones.length");
  if (count > Math.floor(Math.min(config[5], config[9]) / 4))
    fail("RESOURCE_LIMIT", "Tombstones exceed input budget");
  const keys = new Uint32Array(count);
  for (let i = 0; i < count; i++)
    keys[i] = integer(tombstones[i], "tombstone key", 0, 0xffffffff);
  const flat = flatten(docs, config, keys.byteLength);
  return call(() =>
    buildFlat(flat.units, flat.lengths, flat.keys, flat.orders, keys, config),
  );
}
