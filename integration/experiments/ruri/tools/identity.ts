/** Identifies measured source files independently of an uncommitted Git revision. */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export async function sourceIdentity(root: string): Promise<string> {
  const files = [
    "package.json",
    "pnpm-lock.yaml",
    "model.lock.json",
    "runtime.lock.json",
    "quality.lock.json",
    "vite.config.ts",
    "src/main.ts",
    "src/build.d.ts",
    "reference-inputs.json",
    "src/worker.ts",
    "src/encoder.ts",
    "src/assets.ts",
    "src/cache.ts",
    "src/policy.ts",
    "src/profile.ts",
    "src/tokenizer.ts",
    "tools/parity.ts",
    "tools/build-check.ts",
    "tools/reference.py",
    "tools/reference-check.ts",
    "tools/reference.py.lock",
    "tools/quality_cases.py",
    "tools/prepare-quality.ts",
    "tools/quality.ts",
    "tools/pinned.ts",
    "tools/bench.ts",
    "tools/startup.ts",
    "tools/static-server.ts",
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
