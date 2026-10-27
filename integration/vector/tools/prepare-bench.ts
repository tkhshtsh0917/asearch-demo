/** Prepares a fixed scalar query and native oracle from an explicitly supplied base publication. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFile, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const input = process.argv[2];
if (!input) throw new Error("Pass a base vector manifest path");
const manifest = JSON.parse(await readFile(input, "utf8"));
assert.equal(manifest.artifacts.length, 1);
const entry = manifest.artifacts[0];
assert.match(entry.url, /^[a-zA-Z0-9._-]+$/);
const source = resolve(dirname(input), entry.url);
assert.ok((await stat(source)).size <= 128 * 1024 ** 2);
const cli = resolve(
  ".artifacts",
  process.platform === "win32" ? "vector-store.exe" : "vector-store",
);
const info = JSON.parse(
  execFileSync(cli, ["inspect", "--input", source, "--profile", "expanded"], {
    encoding: "utf8",
  }),
);
assert.ok([10000, 50000].includes(info.rows));
assert.equal(info.dimensions, 256);
assert.equal(info.sha256, entry.sha256);
const name = info.rows === 10000 ? "bulk" : "bulk50k";
entry.url = `${name}.vecx`;
const publication = resolve("public/fixtures", `${name}.json`),
  query = resolve("public/fixtures", `${name}-query.json`);
await copyFile(source, resolve("public/fixtures", entry.url));
await writeFile(publication, JSON.stringify(manifest));
await writeFile(
  query,
  JSON.stringify(Array.from({ length: 256 }, (_, i) => (i === 0 ? 1 : 0))),
);
const result = execFileSync(cli, [
  "search",
  "--manifest",
  publication,
  "--query",
  query,
  "--k",
  "10",
  "--profile",
  "expanded",
]);
await writeFile(resolve("public/fixtures", `${name}-oracle.json`), result);
