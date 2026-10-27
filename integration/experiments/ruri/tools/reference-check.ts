/** Binds native reference records to the exact model profile, scripts and inputs. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { sha256 } from "./pinned.ts";
export async function assertReference(
  root: string,
  reference: {
    modelLockSha256: string;
    referenceScriptSha256: string;
    pythonLockSha256: string;
    inputSha256: string;
  },
  input: string,
) {
  for (const [name, expected] of [
    ["model.lock.json", reference.modelLockSha256],
    ["tools/reference.py", reference.referenceScriptSha256],
    ["tools/reference.py.lock", reference.pythonLockSha256],
    [input, reference.inputSha256],
  ] as const)
    assert.equal(
      sha256(await readFile(resolve(root, name))),
      expected,
      `Stale native reference: ${name}`,
    );
}
