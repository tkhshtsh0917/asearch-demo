/** Attaches an explicitly prepared optional publication only to matching primary catalogs. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { semanticPin, semanticRelease } from "../../src/semantic/identity.ts";
import { release } from "../../src/shared/catalog.ts";

const root = new URL("../../", import.meta.url);
let text: string | undefined;
try {
  text = await readFile(new URL(".semantic/pin.json", root), "utf8");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
if (text) {
  const pin = semanticPin(JSON.parse(text));
  const bytes = await readFile(
    new URL(`public/site/semantic/${pin.url}`, root),
  );
  assert.equal(createHash("sha256").update(bytes).digest("hex"), pin.sha256);
  const semantic = semanticRelease(JSON.parse(bytes.toString()));
  const path = new URL("public/site/data/release.json", root);
  const primary = release(JSON.parse(await readFile(path, "utf8")));
  for (const [i, stage] of primary.stages.entries()) {
    assert.equal(
      stage.catalogSha256,
      semantic.stages[i]?.catalogSha256,
      "Rebuild optional semantic assets after changing catalogs",
    );
    assert.equal(
      stage.manifest,
      semantic.stages[i]?.lexicalManifest,
      "Rebuild optional semantic assets after changing lexical publication",
    );
  }
  await writeFile(path, `${JSON.stringify({ ...primary, semantic: pin })}\n`);
}
