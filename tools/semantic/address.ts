/** Gives vector files and manifests immutable content-derived URLs after native construction. */
import { createHash } from "node:crypto";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const digest = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
export async function addressVectors(
  directory: string,
  names: readonly string[],
) {
  const addressed = new Map<string, string>();
  for (const name of ["base.vecx", "delta.vecx", "compact.vecx"]) {
    const bytes = await readFile(resolve(directory, name));
    const next = name.replace(".vecx", `.${digest(bytes).slice(0, 20)}.vecx`);
    await rename(resolve(directory, name), resolve(directory, next));
    addressed.set(name, next);
  }
  const output: string[] = [];
  for (const name of names) {
    const manifest = JSON.parse(
      await readFile(resolve(directory, name), "utf8"),
    );
    for (const artifact of manifest.artifacts) {
      const next = addressed.get(artifact.url);
      if (!next) throw new Error("Unknown vector artifact URL");
      artifact.url = next;
    }
    const bytes = new TextEncoder().encode(`${JSON.stringify(manifest)}\n`),
      next = `manifest.${digest(bytes).slice(0, 20)}.json`;
    await writeFile(resolve(directory, next), bytes, { flag: "wx" });
    await unlink(resolve(directory, name));
    output.push(next);
  }
  return output;
}
