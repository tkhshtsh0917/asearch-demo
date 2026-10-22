/** Loads a coherent manifest/catalog pair without changing the active search state. */
import { diffManifest, type Manifest } from "asearch-wasm";
import { assetName, catalog, type Release } from "../shared/catalog.ts";
import { jsonAsset } from "./load.ts";

/** Validates the expected stage identity and catalog digest before segment adoption. */
export async function candidate(base: URL, info: Release, index: number) {
  const descriptor = info.stages[index];
  if (!descriptor) throw new Error("Missing stage");

  const manifest = (await jsonAsset(base, descriptor.manifest)) as Manifest;
  diffManifest(undefined, manifest);
  if (
    manifest.indexId !== "auto-wiki-qa-questions" ||
    manifest.generation !== index + 1 ||
    manifest.index.major !== 1 ||
    manifest.index.minor !== 0 ||
    manifest.index.symbol_unit !== "code-point" ||
    manifest.index.normalizer.id !== "ja-basic" ||
    manifest.index.normalizer.version !== 1 ||
    manifest.index.normalizer.options !== 31
  )
    throw new Error("Unexpected index definition");

  for (const part of manifest.segments) assetName(part.url);

  const rows = catalog(
    await jsonAsset(
      base,
      descriptor.catalog,
      8 * 1024 * 1024,
      descriptor.catalogSha256,
    ),
  );

  return { manifest, questions: new Map(rows.map((row) => [row.key, row])) };
}
