/** Records exact static-site files and checks the bytes returned by Artifact transport. */
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export async function siteHashes(
  directory: string,
): Promise<Record<string, string>> {
  const hashes: Record<string, string> = Object.create(null);
  async function visit(relative: string) {
    const entries = await readdir(join(directory, relative), {
      withFileTypes: true,
    });
    for (const entry of entries.sort((a, b) =>
      a.name.localeCompare(b.name, "en"),
    )) {
      if (entry.name.startsWith("."))
        throw new Error("Hidden site files are not published");
      const path = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) {
        hashes[path] = createHash("sha256")
          .update(await readFile(join(directory, path)))
          .digest("hex");
      } else
        throw new Error("Static-site files must not be links or special files");
    }
  }
  await visit("");
  return hashes;
}

/** Rejects missing, changed and extra files instead of checking a selected subset. */
export async function verifySite(
  directory: string,
  expected: unknown,
): Promise<void> {
  if (!expected || typeof expected !== "object" || Array.isArray(expected))
    throw new Error("Invalid site hash manifest");
  const entries = Object.entries(expected);
  if (
    !entries.length ||
    entries.some(
      ([name, hash]) =>
        !name || typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash),
    )
  )
    throw new Error("Invalid site hash manifest");
  const actual = await siteHashes(directory);
  if (
    Object.keys(actual).length !== entries.length ||
    entries.some(([name, hash]) => actual[name] !== hash)
  )
    throw new Error("Pages artifact content mismatch");
}
