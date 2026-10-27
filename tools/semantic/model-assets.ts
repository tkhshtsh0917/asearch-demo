/** Copies only the captured model/runtime profile after checking every retained byte. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { profileDescription } from "../../integration/experiments/ruri/src/profile.ts";
export async function copyModelAssets(ruri: string, encoder: string) {
  for (const [prefix, files] of [
    ["models/ruri", profileDescription.model.files],
    ["runtime", profileDescription.runtime.files],
  ] as const) {
    const destination = resolve(encoder, prefix);
    await mkdir(destination, { recursive: true });
    for (const file of files) {
      const source = resolve(ruri, "public", prefix, file.path);
      assert.equal((await stat(source)).size, file.bytes);
      const bytes = await readFile(source);
      assert.equal(bytes.length, file.bytes);
      assert.equal(
        createHash("sha256").update(bytes).digest("hex"),
        file.sha256,
        "Prepared encoder asset mismatch",
      );
      await writeFile(resolve(destination, file.path), bytes, { flag: "wx" });
    }
  }
}
