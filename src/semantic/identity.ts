/** Validates the application's bounded binding between lexical and vector publications. */
import { assetName } from "../shared/asset.ts";

export interface SemanticPin {
  url: string;
  sha256: string;
}
export interface SemanticStage {
  catalog: string;
  catalogSha256: string;
  lexicalManifest: string;
  vectorManifest: string;
  vectorManifestSha256: string;
  space: string;
}
export interface SemanticRelease {
  schema: 1;
  encoderProfile: string;
  encoderWorker: string;
  encoderDirectory: string;
  bindingsDirectory: string;
  stages: SemanticStage[];
}
export function sha(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value))
    throw new Error("Invalid semantic digest");
  return value;
}
export function semanticPin(value: unknown): SemanticPin {
  if (!value || typeof value !== "object")
    throw new Error("Invalid semantic pin");
  const pin = value as SemanticPin;
  return { url: assetName(pin.url), sha256: sha(pin.sha256) };
}
export function semanticRelease(value: unknown): SemanticRelease {
  if (!value || typeof value !== "object")
    throw new Error("Invalid semantic publication");
  const release = value as SemanticRelease;
  if (
    release.schema !== 1 ||
    !Array.isArray(release.stages) ||
    release.stages.length !== 3
  )
    throw new Error("Invalid semantic stages");
  return {
    schema: 1,
    encoderProfile: sha(release.encoderProfile),
    encoderWorker: assetName(release.encoderWorker),
    encoderDirectory: assetName(release.encoderDirectory),
    bindingsDirectory: assetName(release.bindingsDirectory),
    stages: release.stages.map((s) => ({
      catalog: assetName(s.catalog),
      catalogSha256: sha(s.catalogSha256),
      lexicalManifest: assetName(s.lexicalManifest),
      vectorManifest: assetName(s.vectorManifest),
      vectorManifestSha256: sha(s.vectorManifestSha256),
      space: sha(s.space),
    })),
  };
}
