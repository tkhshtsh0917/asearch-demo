/** Builds optional coherent vector publications from explicit native release assets. */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { profileDescription } from "../../integration/experiments/ruri/src/profile.ts";
import { sourceIdentity } from "../../integration/experiments/ruri/tools/identity.ts";
import type { SemanticRelease } from "../../src/semantic/identity.ts";
import { catalog, release } from "../../src/shared/catalog.ts";
import { addressVectors } from "./address.ts";
import { prepareDocuments } from "./documents.ts";
import { copyModelAssets } from "./model-assets.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const bundle = process.argv[2];
if (!bundle)
  throw new Error("Pass an explicit vector release bundle directory");
const integration = resolve(root, "integration/vectide");
const ruri = resolve(root, "integration/experiments/ruri");
const encoderSource = await sourceIdentity(ruri);
const run = (file: string, args: string[], cwd = root) =>
  execFileSync(file, args, { cwd, stdio: "inherit" });
run(
  "mise",
  [
    "exec",
    "--",
    process.execPath,
    "tools/prepare.ts",
    resolve(bundle),
    ...process.argv.slice(3),
  ],
  integration,
);
const cli = resolve(
  integration,
  `.artifacts/vectide${process.platform === "win32" ? ".exe" : ""}`,
);
const native = (...args: string[]) =>
  JSON.parse(execFileSync(cli, args, { encoding: "utf8" }));
const digest = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");
const encode = (value: unknown) => `${JSON.stringify(value)}\n`;
const workspace = resolve(root, ".semantic");
await mkdir(workspace, { recursive: true });
const site = resolve(root, "public/site"),
  data = resolve(site, "data");
const primary = release(
  JSON.parse(await readFile(resolve(data, "release.json"), "utf8")),
);
const catalogs = await Promise.all(
  primary.stages.map(async (s) => {
    const bytes = await readFile(resolve(data, s.catalog));
    assert.equal(digest(bytes), s.catalogSha256);
    return catalog(JSON.parse(bytes.toString()));
  }),
);
const base = catalogs[0],
  updated = catalogs[1];
assert.ok(base && updated && base.length === 10000);
const byId = new Map(base.map((q) => [q.key, q.text]));
const changes = updated.filter((q) => byId.get(q.key) !== q.text);
const updatedIds = new Set(updated.map((q) => q.key));
const dead = base
  .filter((q) => !updatedIds.has(q.key))
  .map((q) => q.key)
  .sort((a, b) => a - b);
assert.equal(changes.length, 4);
assert.equal(dead.length, 1);
await prepareDocuments(root, base, changes);
const output = resolve(site, "semantic");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
assert.deepEqual(
  JSON.parse(await readFile(resolve(ruri, "model.lock.json"), "utf8")),
  profileDescription.model,
);
assert.deepEqual(
  JSON.parse(await readFile(resolve(ruri, "runtime.lock.json"), "utf8")),
  profileDescription.runtime,
);
const profile = digest(JSON.stringify(profileDescription));
const descriptor = encode({
  dimensions: 256,
  metric: "cosine_f32_normalized_v1",
  encoderProfile: profile,
  profile: profileDescription,
});
const space = resolve(workspace, "space.json");
await writeFile(space, descriptor);
const tomb = resolve(workspace, "tombstones.json");
await writeFile(tomb, encode(dead));
const baseFile = resolve(output, "base.vecx"),
  delta = resolve(output, "delta.vecx");
native(
  "build",
  "--input",
  resolve(workspace, "base-vectors.jsonl"),
  "--descriptor",
  space,
  "--output",
  baseFile,
);
native(
  "build",
  "--input",
  resolve(workspace, "updates-vectors.jsonl"),
  "--descriptor",
  space,
  "--output",
  delta,
  "--generation",
  "1",
  "--tombstones",
  tomb,
);
const manifests = ["base.json", "updated.json", "compact.json"] as const;
const initialStage = primary.stages[0],
  updatedStage = primary.stages[1];
assert.ok(initialStage && updatedStage);
native(
  "publish",
  "--input",
  baseFile,
  "--revision",
  initialStage.catalogSha256,
  "--url",
  "base.vecx",
  "--output",
  resolve(output, manifests[0]),
);
native(
  "publish",
  "--input",
  delta,
  "--revision",
  updatedStage.catalogSha256,
  "--url",
  "delta.vecx",
  "--output",
  resolve(output, manifests[1]),
  "--parent",
  resolve(output, manifests[0]),
);
native(
  "compact",
  "--manifest",
  resolve(output, manifests[1]),
  "--output",
  resolve(output, "compact.vecx"),
  "--url",
  "compact.vecx",
  "--manifest-output",
  resolve(output, manifests[2]),
);
const queryFile = resolve(workspace, "integrity-query.json");
await writeFile(
  queryFile,
  JSON.stringify(Array.from({ length: 256 }, (_, i) => (i === 0 ? 1 : 0))),
);
const beforeAddress = manifests.map((name) =>
  native("search", "--manifest", resolve(output, name), "--query", queryFile),
);
const addressed = await addressVectors(output, manifests);
for (const [i, name] of addressed.entries())
  assert.deepEqual(
    native("search", "--manifest", resolve(output, name), "--query", queryFile),
    beforeAddress[i],
    "Content addressing must preserve native snapshots and results",
  );
const bindingSource = resolve(integration, "public/bindings");
const bindingHash = createHash("sha256");
for (const name of (await readdir(bindingSource)).toSorted()) {
  const bytes = await readFile(resolve(bindingSource, name));
  bindingHash.update(`${name}\0${bytes.length}\0`).update(bytes);
}
const bindingsDirectory = `bindings-${bindingHash.digest("hex").slice(0, 20)}`;
await cp(bindingSource, resolve(output, bindingsDirectory), {
  recursive: true,
});

run("pnpm", ["prepare:model"], ruri);
run("pnpm", ["build"], ruri);
assert.equal(
  await sourceIdentity(ruri),
  encoderSource,
  "Encoder source changed during publication",
);
const encoderDirectory = `encoder-${profile.slice(0, 20)}`;
const encoder = resolve(output, encoderDirectory);
await mkdir(encoder, { recursive: true });
const assets = await readdir(resolve(ruri, "dist/assets"));
const worker = assets.find((name) => /^worker-[\w-]+\.js$/.test(name));
assert.ok(worker);
await cp(resolve(ruri, "dist/assets", worker), resolve(encoder, worker));
await copyModelAssets(ruri, encoder);

const licenses = resolve(output, "licenses");
await mkdir(licenses, { recursive: true });
await cp(resolve(ruri, "licenses"), resolve(licenses, "encoder"), {
  recursive: true,
});
for (const name of ["LICENSE-MIT", "LICENSE-APACHE", "THIRD-PARTY-NOTICES.txt"])
  await cp(
    resolve(integration, ".artifacts", name),
    resolve(licenses, `vector-${name}`),
  );
await cp(
  resolve(integration, ".artifacts/LICENSE-APACHE"),
  resolve(licenses, "ruri-Apache-2.0.txt"),
);
const stages = await Promise.all(
  primary.stages.map(async (s, i) => {
    const manifestName = addressed[i];
    assert.ok(manifestName);
    const bytes = await readFile(resolve(output, manifestName));
    const manifest = JSON.parse(bytes.toString());
    return {
      catalog: s.catalog,
      catalogSha256: s.catalogSha256,
      lexicalManifest: s.manifest,
      vectorManifest: manifestName,
      vectorManifestSha256: digest(bytes),
      space: manifest.space,
    };
  }),
);
const publication: SemanticRelease = {
  schema: 1,
  encoderProfile: profile,
  encoderWorker: worker,
  encoderDirectory,
  bindingsDirectory,
  stages,
};
const bytes = encode(publication),
  name = `release.${digest(bytes).slice(0, 20)}.json`;
await writeFile(resolve(output, name), bytes);
await writeFile(
  resolve(workspace, "pin.json"),
  encode({ url: name, sha256: digest(bytes) }),
);
await cp(
  resolve(integration, ".artifacts/release.json"),
  resolve(output, "vector-release.json"),
);
run(process.execPath, ["tools/semantic/attach.ts"]);
console.log("Prepared coherent semantic base/delta/compacted publications.");
