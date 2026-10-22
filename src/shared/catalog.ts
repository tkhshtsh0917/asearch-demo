/** Validates publication metadata and safe question/source records before display. */
export interface Question {
  key: number;
  text: string;
  title: string;
  url: string;
}
export interface Stage {
  manifest: string;
  catalog: string;
  catalogSha256: string;
}
export interface Release {
  stages: Stage[];
  attribution: { creator: string; license: string; changes: string };
}

export function assetName(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[a-zA-Z0-9._-]+$/.test(value) ||
    value === "." ||
    value === ".."
  )
    throw new Error("Invalid asset filename");
  return value;
}

export function sourceUrl(value: unknown): string {
  if (value === "") return "";
  if (typeof value !== "string") throw new Error("Invalid source URL");
  const url = new URL(value);
  if (
    url.origin !== "https://ja.wikipedia.org" ||
    !url.pathname.startsWith("/wiki/") ||
    url.username ||
    url.password
  )
    throw new Error("Invalid source URL");
  return url.href;
}

export function catalog(value: unknown): Question[] {
  if (!Array.isArray(value) || value.length > 20000)
    throw new Error("Invalid catalog size");
  const keys = new Set<number>();
  return value.map((row: unknown) => {
    if (!row || typeof row !== "object") throw new Error("Invalid catalog row");
    const { key, text, title, url } = row as Question;
    if (
      !Number.isInteger(key) ||
      key < 0 ||
      key > 0xffffffff ||
      keys.has(key) ||
      typeof text !== "string" ||
      !text.trim() ||
      text.length > 65535 ||
      typeof title !== "string" ||
      title.length > 65535
    )
      throw new Error("Invalid catalog entry");
    keys.add(key);
    return { key, text, title, url: sourceUrl(url) };
  });
}

export function release(value: unknown): Release {
  if (!value || typeof value !== "object") throw new Error("Invalid release");
  const { stages, attribution } = value as Release;
  if (
    !Array.isArray(stages) ||
    stages.length !== 3 ||
    !attribution ||
    typeof attribution.creator !== "string" ||
    attribution.license !== "CC-BY-SA-4.0" ||
    typeof attribution.changes !== "string"
  )
    throw new Error("Invalid release metadata");
  return {
    stages: stages.map(({ manifest, catalog, catalogSha256 }) => {
      if (!/^[a-f0-9]{64}$/.test(catalogSha256))
        throw new Error("Invalid catalog digest");
      return {
        manifest: assetName(manifest),
        catalog: assetName(catalog),
        catalogSha256,
      };
    }),
    attribution: {
      creator: attribution.creator,
      license: attribution.license,
      changes: attribution.changes,
    },
  };
}
