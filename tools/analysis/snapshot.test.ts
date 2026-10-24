import assert from "node:assert/strict";
import {
  existsSync,
  readFileSync,
  rmSync,
  truncateSync,
  writeFileSync,
} from "node:fs";
import test from "node:test";
import { digest } from "./cache.ts";
import { dictionaryPath } from "./pins.ts";
import { prepareResources } from "./resources.ts";
import { createAnalysis } from "./run.ts";
import { fixture } from "./testing/fixture.ts";

const rows = [{ key: 0, text: "京都", title: "", url: "" }];

test("preparation rejects pin changes and preserves the previous ready pointer", async (t) => {
  const f = fixture(t);
  await f.prepare();
  const ready = readFileSync(f.paths.ready);
  f.hooks.compile = () => f.source("stopwords.txt", "new");

  await assert.rejects(
    prepareResources(f.paths, f.paths.cli, f.run),
    /inputs changed/,
  );
  assert.deepEqual(readFileSync(f.paths.ready), ready);
  assert.throws(() => createAnalysis(f.paths), /preparation is stale/);
});

test("preparation fingerprints the executed CLI and rejects replacement during preparation", async (t) => {
  const f = fixture(t);
  await f.prepare();
  const ready = readFileSync(f.paths.ready);
  f.hooks.compile = () => f.cli("B");

  await assert.rejects(
    prepareResources(f.paths, f.paths.cli, f.run),
    /inputs changed/,
  );
  assert.deepEqual(readFileSync(f.paths.ready), ready);
  assert.throws(() => createAnalysis(f.paths), /preparation is stale/);
});

test("all batches and provenance keep their captured generation across resource and policy updates", async (t) => {
  const f = fixture(t);
  const old = await f.prepare();
  const provenance = old.provenance();
  assert.equal(old.analyze(rows)[0]?.texts[1], "old/1/A/D");

  f.source("stopwords.txt", "new");
  f.policy(2);
  f.cli("B");
  f.lock.dictionary.systemSha256 = digest("E");
  f.saveLock();
  writeFileSync(dictionaryPath(f.lock, f.paths.directory), "E");
  const next = await f.prepare();
  rmSync(new URL(provenance.compiledFile, f.paths.directory));

  assert.deepEqual(old.provenance(), provenance);
  assert.equal(old.analyze(rows)[0]?.texts[1], "old/1/A/D");
  assert.equal(next.analyze(rows)[0]?.texts[1], "new/2/B/E");
  assert.equal(
    next.provenance().policySha256,
    digest(readFileSync(f.paths.policy)),
  );
  assert.equal(
    next.provenance().resourceLockSha256,
    digest(readFileSync(f.paths.lock)),
  );
  assert.equal(
    next.provenance().analyzerCliSha256,
    digest(readFileSync(f.paths.cli)),
  );

  const exposed = old.provenance();
  exposed.resources.revision = "b".repeat(40);
  assert.deepEqual(old.provenance(), provenance);
});

test("snapshot validation rejects stale executables and corrupted converted resources", async (t) => {
  const f = fixture(t);
  const analysis = await f.prepare();
  f.cli("B");
  assert.throws(() => createAnalysis(f.paths), /preparation is stale/);
  f.cli("A");
  writeFileSync(
    new URL(analysis.provenance().compiledFile, f.paths.directory),
    "corrupt",
  );
  assert.throws(() => createAnalysis(f.paths), /preparation is stale/);
});

test("analysis input/output bounds remain active and private files are removed on failure", async (t) => {
  const f = fixture(t);
  await f.prepare();
  let binaryPath = "",
    outputPath = "",
    calls = 0;
  const analysis = createAnalysis(f.paths, (args, binary) => {
    calls++;
    binaryPath = binary;
    const output = args.at(-1);
    assert.ok(output);
    outputPath = output;
    writeFileSync(output, "");
    truncateSync(output, 64 * 1024 * 1024 + 1);
  });

  assert.deepEqual(analysis.analyze([]), []);
  assert.throws(
    () => analysis.analyze(Array(20001).fill(rows[0])),
    /record limit/,
  );
  const large = {
    ...rows[0],
    key: 0,
    text: "a".repeat(16384),
    title: "",
    url: "",
  };
  assert.throws(
    () => analysis.analyze(Array(1024).fill(large)),
    /input byte limit/,
  );
  assert.equal(calls, 0);
  assert.throws(() => analysis.analyze(rows), /output byte limit/);
  assert.equal(calls, 1);
  assert.equal(existsSync(binaryPath), false);
  assert.equal(existsSync(outputPath), false);
});
