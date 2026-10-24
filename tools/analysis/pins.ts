/** Resolves only approved, hash-pinned upstream resources and local cache filenames. */
import type { Pin } from "./cache.ts";

export const root = new URL("../../", import.meta.url);
export const resourceDirectory = new URL(".analysis/resources/", root);
export interface ResourcePaths {
  lock: URL;
  ready: URL;
  directory: URL;
}

export const resourcePaths: ResourcePaths = {
  lock: new URL("resources.lock.json", import.meta.url),
  ready: new URL(".analysis/ready.json", root),
  directory: resourceDirectory,
};

export interface ResourceLock {
  repository: string;
  revision: string;
  files: Record<
    string,
    Pin & { repository?: string; revision?: string; source: string }
  >;
  dictionary: Pin & {
    version: string;
    url: string;
    member: string;
    systemBytes: number;
    systemSha256: string;
  };
}

export function sourceURL(name: string, resourceLock: ResourceLock): string {
  const pin = resourceLock.files[name];
  if (!pin) throw new Error("Unknown analysis resource");
  const repository = pin.repository ?? resourceLock.repository;
  const revision = pin.revision ?? resourceLock.revision;
  if (
    ![
      "WorksApplications/SudachiDict",
      "WorksApplications/elasticsearch-sudachi",
    ].includes(repository) ||
    !/^[a-f0-9]{40}$/.test(revision) ||
    !/^[a-zA-Z0-9/._-]+$/.test(pin.source) ||
    pin.source.split("/").includes("..") ||
    !Number.isSafeInteger(pin.bytes) ||
    pin.bytes < 1 ||
    pin.bytes > 8 * 1024 * 1024
  )
    throw new Error("Invalid analysis source pin");
  return `https://raw.githubusercontent.com/${repository}/${revision}/${pin.source}`;
}

export function resourcePath(
  name: string,
  resourceLock: ResourceLock,
  directory = resourceDirectory,
): URL {
  const pin = resourceLock.files[name];
  if (
    !pin ||
    !/^[a-f0-9]{64}$/.test(pin.sha256) ||
    !/^[a-zA-Z0-9._-]+$/.test(name)
  )
    throw new Error("Invalid analysis resource definition");
  return new URL(`${pin.sha256}.${name}`, directory);
}

export function dictionaryPath(
  resourceLock: ResourceLock,
  directory = resourceDirectory,
): URL {
  const sha = resourceLock.dictionary.systemSha256;
  if (!/^[a-f0-9]{64}$/.test(sha)) throw new Error("Invalid dictionary digest");
  return new URL(`system.${sha}.dic`, directory);
}
