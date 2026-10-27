/** Identifies measured source files independently of an uncommitted Git revision. */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export async function sourceIdentity(root: string): Promise<string> {
  const files = [
    "package.json",
    "pnpm-lock.yaml",
    "model.lock.json",
    "vite.config.ts",
    "src/main.ts",
    "src/worker.ts",
    "src/encoder.ts",
    "src/assets.ts",
    "src/policy.ts",
    "tools/bench.ts",
    "tools/prepare.ts",
    "tools/identity.ts",
  ];
  const hash = createHash("sha256");
  for (const name of files.toSorted()) {
    const data = await readFile(resolve(root, name));
    hash.update(`${name}\0${data.byteLength}\0`).update(data);
  }
  return hash.digest("hex");
}
