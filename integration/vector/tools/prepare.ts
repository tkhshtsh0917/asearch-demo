/** Verifies an explicitly selected bundle, generates bindings and builds native test fixtures. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { adoptDirectories } from "./adopt.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const directory = process.argv[2];
if (!directory)
  throw new Error(
    "Pass an explicit release bundle directory; no checkout is built implicitly",
  );
const metadataPath = resolve(directory, "release.json");
assert.ok((await stat(metadataPath)).size <= 65536);
const sumsPath = resolve(directory, "SHA256SUMS");
assert.ok((await stat(sumsPath)).size <= 16384);
const sums = new Map<string, string>();
for (const line of (await readFile(sumsPath, "utf8")).trimEnd().split("\n")) {
  const match = /^([0-9a-f]{64}) {2}([a-zA-Z0-9_.-]+)$/.exec(line);
  assert.ok(match?.[1] && match[2]);
  assert.ok(!sums.has(match[2]));
  sums.set(match[2], match[1]);
}
assert.equal(
  createHash("sha256")
    .update(await readFile(metadataPath))
    .digest("hex"),
  sums.get("release.json"),
);
const metadata = JSON.parse(await readFile(metadataPath, "utf8")) as {
  schema: number;
  version: string;
  sourceTreeSha256: string;
  maxLinearMemoryBytes: number;
  abi: number;
  source: string;
  sourceDirty: boolean;
  target: string;
  wasmBindgen: string;
  files: { path: string; bytes: number; sha256: string }[];
};
assert.deepEqual(
  Object.keys(metadata).toSorted(),
  [
    "schema",
    "version",
    "abi",
    "source",
    "sourceDirty",
    "sourceTreeSha256",
    "target",
    "wasmBindgen",
    "maxLinearMemoryBytes",
    "files",
  ].toSorted(),
);
assert.match(metadata.version, /^\d+\.\d+\.\d+$/);
assert.match(metadata.sourceTreeSha256, /^[a-f0-9]{64}$/);
assert.equal(metadata.maxLinearMemoryBytes, 536870912);
const platform = `${process.platform}-${process.arch}`;
const targets: Record<string, string> = {
  "darwin-arm64": "aarch64-apple-darwin",
  "linux-x64": "x86_64-unknown-linux-gnu",
  "win32-x64": "x86_64-pc-windows-msvc",
};
assert.equal(
  metadata.target,
  targets[platform],
  "Bundle native target must match this host",
);
assert.equal(metadata.schema, 1);
assert.equal(metadata.abi, 1);
assert.match(metadata.source, /^[0-9a-f]{40}$/);
assert.equal(typeof metadata.sourceDirty, "boolean");
if (metadata.sourceDirty && !process.argv.includes("--allow-dirty"))
  throw new Error(
    "Dirty source bundle requires explicit --allow-dirty for local tests",
  );
assert.equal(metadata.wasmBindgen, "0.2.129");
assert.equal(metadata.files.length, 5);
assert.equal(sums.size, metadata.files.length + 1);
const executable = metadata.target.endsWith("windows-msvc")
  ? "vector-store.exe"
  : "vector-store";
assert.deepEqual(
  metadata.files.map((f) => f.path).toSorted(),
  [
    executable,
    "vector_wasm.wasm",
    "LICENSE-MIT",
    "LICENSE-APACHE",
    "THIRD-PARTY-NOTICES.txt",
  ].toSorted(),
);
const verified = new Map<string, Uint8Array>();
assert.ok(
  metadata.files.reduce((sum, f) => sum + f.bytes, 0) <= 128 * 1024 ** 2,
);
for (const file of metadata.files) {
  assert.deepEqual(
    Object.keys(file).toSorted(),
    ["path", "bytes", "sha256"].toSorted(),
  );
  assert.ok(
    Number.isSafeInteger(file.bytes) &&
      file.bytes > 0 &&
      file.bytes <= 64 * 1024 * 1024,
  );
  assert.match(file.sha256, /^[0-9a-f]{64}$/);
  assert.equal(file.sha256, sums.get(file.path));
  const source = resolve(directory, file.path);
  assert.equal((await stat(source)).size, file.bytes);
  const bytes = await readFile(source);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), file.sha256);
  assert.equal(bytes.byteLength, file.bytes);
  verified.set(file.path, bytes);
}
const stage = await mkdtemp(resolve(root, ".stage-"));
try {
  const artifactRoot = resolve(stage, "artifacts");
  await mkdir(artifactRoot);
  for (const [name, bytes] of verified)
    await writeFile(resolve(artifactRoot, name), bytes, {
      mode: name === executable ? 0o755 : 0o644,
    });
  await writeFile(
    resolve(artifactRoot, "release.json"),
    `${JSON.stringify(metadata, null, 2)}\n`,
  );
  const cli = resolve(artifactRoot, executable);
  assert.equal(
    execFileSync(cli, ["--version"], { encoding: "utf8" }).trim(),
    `vector-store ${metadata.version}`,
  );
  const command = (args: string[]) =>
    JSON.parse(
      execFileSync(cli, args, { cwd: artifactRoot, encoding: "utf8" }),
    );
  assert.equal(
    execFileSync("wasm-bindgen", ["--version"], { encoding: "utf8" }).trim(),
    "wasm-bindgen 0.2.129",
  );
  const bindings = resolve(stage, "public/bindings");
  await mkdir(bindings, { recursive: true });
  execFileSync(
    "wasm-bindgen",
    [
      resolve(artifactRoot, "vector_wasm.wasm"),
      "--target",
      "web",
      "--out-dir",
      bindings,
      "--out-name",
      "vector_wasm",
    ],
    { stdio: "pipe" },
  );
  await mkdir(resolve(stage, "public/fixtures"), { recursive: true });
  await writeFile(
    resolve(artifactRoot, "space.json"),
    '{"dimensions":3,"model":"conformance-v1"}',
  );
  await writeFile(
    resolve(artifactRoot, "base.jsonl"),
    '{"id":1,"vector":[1,0,0]}\n{"id":9,"vector":[0,1,0]}\n{"id":4294967295,"vector":[1,0,0]}\n',
  );
  await writeFile(
    resolve(artifactRoot, "delta.jsonl"),
    '{"id":7,"vector":[1,0,0]}\n{"id":9,"vector":[0,0,1]}\n',
  );
  await writeFile(resolve(artifactRoot, "deleted.json"), "[1]");
  const revision0 = "a".repeat(64),
    revision1 = "b".repeat(64);
  command([
    "build",
    "--input",
    "base.jsonl",
    "--descriptor",
    "space.json",
    "--output",
    "base.vecx",
  ]);
  command([
    "publish",
    "--input",
    "base.vecx",
    "--revision",
    revision0,
    "--url",
    "base.vecx",
    "--output",
    "base.json",
  ]);
  command([
    "build",
    "--input",
    "delta.jsonl",
    "--descriptor",
    "space.json",
    "--output",
    "delta.vecx",
    "--generation",
    "1",
    "--tombstones",
    "deleted.json",
  ]);
  command([
    "publish",
    "--input",
    "delta.vecx",
    "--revision",
    revision1,
    "--url",
    "delta.vecx",
    "--parent",
    "base.json",
    "--output",
    "updated.json",
  ]);
  command([
    "compact",
    "--manifest",
    "updated.json",
    "--output",
    "compact.vecx",
    "--url",
    "compact.vecx",
    "--manifest-output",
    "compact.json",
  ]);
  await writeFile(resolve(artifactRoot, "query.json"), "[1,0,0]");
  const oracles = Object.fromEntries(
    ["base", "updated", "compact"].map((name) => [
      name,
      command([
        "search",
        "--manifest",
        `${name}.json`,
        "--query",
        "query.json",
        "--k",
        "10",
      ]),
    ]),
  );
  for (const name of [
    "base.vecx",
    "delta.vecx",
    "compact.vecx",
    "base.json",
    "updated.json",
    "compact.json",
  ])
    await copyFile(
      resolve(artifactRoot, name),
      resolve(stage, "public/fixtures", name),
    );
  await writeFile(
    resolve(stage, "public/fixtures/oracles.json"),
    `${JSON.stringify(oracles)}\n`,
  );
  await mkdir(resolve(root, "public"), { recursive: true });
  await adoptDirectories(stage, [
    { source: artifactRoot, target: resolve(root, ".artifacts") },
    { source: bindings, target: resolve(root, "public/bindings") },
    {
      source: resolve(stage, "public/fixtures"),
      target: resolve(root, "public/fixtures"),
    },
  ]);
  process.stdout.write(
    "Verified explicit CLI/WASM assets and prepared native fixture oracles.\n",
  );
} finally {
  await rm(stage, { recursive: true, force: true });
}
