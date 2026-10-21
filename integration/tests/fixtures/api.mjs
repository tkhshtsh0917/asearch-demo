import * as api from "../../packages/asearch-wasm/dist/node.mjs";
import { buildDelta, buildIndex } from "./builders.mjs";
import { invoke } from "./server.mjs";

export * from "../../packages/asearch-wasm/dist/node.mjs";
export { buildDelta, buildIndex };
export function withFixtures(api) {
  const AsearchIndex = api.AsearchIndex;
  AsearchIndex.fromDocs = (docs, options) =>
    AsearchIndex.fromBytes(buildIndex(docs, options), options);
  AsearchIndex.fromStrings = (texts, options) =>
    AsearchIndex.fromDocs(
      Array.from(
        {
          length: (() => {
            const n = texts.length;
            if (!Number.isSafeInteger(n) || n < 0)
              throw new TypeError("invalid fixture count");
            return n;
          })(),
        },
        (_, key) => ({ key, texts: [texts[key]] }),
      ),
      options,
    );
  AsearchIndex.prototype.toBytes = function () {
    return invoke(
      "compact",
      this.segments().map((s) => s.id),
    );
  };
  return { ...api, AsearchIndex, buildIndex, buildDelta };
}
export const AsearchIndex = withFixtures(api).AsearchIndex;
