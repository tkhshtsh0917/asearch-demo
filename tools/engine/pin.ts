export interface EnginePin {
  readonly repository: string;
  readonly revision: string;
  readonly package: "asearch-wasm";
  readonly version: string;
  readonly archive: string;
  readonly sha256: string;
}
export function enginePin(value: unknown): EnginePin {
  if (typeof value !== "object" || value === null)
    throw new Error("Invalid engine pin");
  const {
    repository,
    revision,
    package: name,
    version,
    archive,
    sha256,
  } = value as Record<string, unknown>;
  if (
    typeof repository !== "string" ||
    !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\.git$/.test(
      repository,
    ) ||
    typeof revision !== "string" ||
    !/^[a-f0-9]{40}$/.test(revision) ||
    name !== "asearch-wasm" ||
    typeof version !== "string" ||
    !/^\d+\.\d+\.\d+$/.test(version) ||
    typeof archive !== "string" ||
    archive !== `asearch-wasm-${version}.tgz` ||
    typeof sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(sha256)
  )
    throw new Error("Invalid engine source or archive identity");
  return Object.freeze({
    repository,
    revision,
    package: name,
    version,
    archive,
    sha256,
  });
}
