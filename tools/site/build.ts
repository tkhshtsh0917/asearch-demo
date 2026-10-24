import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { catalog } from "../../src/shared/catalog.ts";
import { verifyBytes } from "../analysis/cache.ts";
import { resourcePath } from "../analysis/pins.ts";
import { createAnalysis } from "../analysis/run.ts";
import { digest, publish } from "./publish.ts";

const root = new URL("../../", import.meta.url);
const lock = JSON.parse(
  await readFile(new URL("dataset.lock.json", root), "utf8"),
);
const text = await readFile(
  new URL("public/data/questions.jsonl", root),
  "utf8",
);
if (digest(text) !== lock.outputSha256)
  throw new Error("Question corpus digest mismatch");
const rows = catalog(
  text
    .trimEnd()
    .split("\n")
    .map((line) => JSON.parse(line)),
);
if (rows.length !== lock.rows) throw new Error("Question count mismatch");
const attribution = JSON.parse(
  await readFile(new URL("public/data/attribution.json", root), "utf8"),
);
const analysis = createAnalysis();
const files = await publish(
  rows,
  {
    creator: attribution.creator,
    license: attribution.license,
    changes: `Source: https://huggingface.co/datasets/cl-nagoya/auto-wiki-qa/tree/${lock.revision}; upstream: https://huggingface.co/datasets/hpprc/jawiki; license: https://creativecommons.org/licenses/by-sa/4.0/. ${attribution.changes} Search-only forms add Sudachi readings, romanizations and SudachiDict synonyms; displayed source questions are unchanged. See data/analysis.json for language-resource pins and filtering policy. Demo stages additionally modify three questions, delete one and add one synthetic question. These derived catalogs are CC-BY-SA-4.0.`,
  },
  analysis,
);
const output = new URL("public/site/data/", root);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const [name, bytes] of files)
  await writeFile(new URL(name, output), bytes);
console.log(
  `Published ${rows.length} questions in ${files.size} immutable assets`,
);

// Retain all attribution notices alongside the redistributed WASM artifact.
const packageRoot = new URL("../", import.meta.resolve("asearch-wasm"));
const licenseRoot = new URL("public/site/licenses/", root);
const resourceLock = analysis.provenance().resources;
await rm(licenseRoot, { recursive: true, force: true });
await mkdir(licenseRoot, { recursive: true });
for (const name of [
  "LICENSE-2.0.txt",
  "LEGAL",
  "elasticsearch-sudachi-LICENSE",
]) {
  const bytes = await readFile(resourcePath(name, resourceLock));
  const pin = resourceLock.files[name];
  if (!pin) throw new Error("Missing language-resource license");
  verifyBytes(bytes, pin);
  await writeFile(
    new URL(
      name.startsWith("elasticsearch") ? name : `SudachiDict-${name}`,
      licenseRoot,
    ),
    bytes,
  );
}
for (const name of ["LICENSE-MIT", "LICENSE-APACHE", "NOTICE"]) {
  await cp(new URL(name, packageRoot), new URL(name, licenseRoot));
}
await cp(
  new URL("dist/licenses/", packageRoot),
  new URL("third-party/", licenseRoot),
  { recursive: true },
);

await cp(new URL("LICENSE", root), new URL("demo-MIT.txt", licenseRoot));
// The production bundle includes Vite's modulepreload polyfill.
await cp(
  new URL("node_modules/vite/LICENSE.md", root),
  new URL("vite-LICENSE.md", licenseRoot),
);
await cp(
  new URL("tools/analysis/licenses/wana_kana-MIT.txt", root),
  new URL("wana_kana-MIT.txt", licenseRoot),
);
