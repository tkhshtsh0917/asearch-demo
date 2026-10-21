import * as api from "../../packages/asearch-wasm/dist/web.mjs";
import { buildDelta, buildIndex } from "./browser-builders.mjs";
import { request } from "./browser-transport.mjs";

export * from "../../packages/asearch-wasm/dist/web.mjs";
export { buildDelta, buildIndex };
export const AsearchIndex = api.AsearchIndex;
AsearchIndex.fromDocs = async (docs, options) =>
  AsearchIndex.fromBytes(await buildIndex(docs, options), options);
AsearchIndex.fromStrings = (texts, options) =>
  AsearchIndex.fromDocs(
    texts.map((text, key) => ({ key, texts: [text] })),
    options,
  );
AsearchIndex.prototype.toBytes = function () {
  return request(
    "compact",
    this.segments().map((s) => s.id),
  );
};
