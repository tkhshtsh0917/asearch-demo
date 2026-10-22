import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { prepareRelease, releasePin } from "./release.ts";

test("release identity requires a version tag and an actual platform checksum", () => {
  const value = {
    repository: "https://github.com/example/search",
    tag: "v0.1.0",
    assets: { "linux-x86_64": "a".repeat(64) },
  };
  assert.equal(
    releasePin(value, "linux-x86_64").archive,
    "asearch-assets-linux-x86_64.tar.gz",
  );
  for (const candidate of [
    { ...value, tag: "main" },
    { ...value, repository: "https://user:secret@github.com/example/search" },
    { ...value, assets: { "linux-x86_64": null } },
  ])
    assert.throws(() => releasePin(candidate, "linux-x86_64"));
});

test("local release bundles are verified before replacing prepared artifacts", async (t) => {
  const temp = await mkdtemp(join(tmpdir(), "asearch-release-test-"));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const platform = `${process.platform === "darwin" ? "macos" : process.platform === "win32" ? "windows" : process.platform}-${process.arch === "arm64" ? "aarch64" : process.arch === "x64" ? "x86_64" : process.arch}`;
  const bundle = join(temp, "bundle");
  await mkdir(bundle);
  const cli = process.platform === "win32" ? "asearch-cli.exe" : "asearch-cli";
  for (const name of [
    cli,
    "asearch_wasm.wasm",
    "NOTICE",
    "LICENSE-MIT",
    "LICENSE-APACHE",
  ])
    await writeFile(join(bundle, name), "fixture");
  const archive = `asearch-assets-${platform}.tar.gz`;
  assert.equal(
    spawnSync("tar", ["-czf", join(temp, archive), "-C", bundle, "."]).status,
    0,
  );
  const bytes = await readFile(join(temp, archive));
  await writeFile(
    join(temp, "release.lock.json"),
    JSON.stringify({
      repository: "https://github.com/example/search",
      tag: "v0.1.0",
      assets: { [platform]: createHash("sha256").update(bytes).digest("hex") },
    }),
  );
  const root = pathToFileURL(`${temp}/`);
  await prepareRelease(root, temp);
  await writeFile(join(temp, archive), "corrupt");
  await assert.rejects(prepareRelease(root, temp), /SHA-256/);
  assert.equal(
    await readFile(new URL(`integration/.engine/release/${cli}`, root), "utf8"),
    "fixture",
  );
});
