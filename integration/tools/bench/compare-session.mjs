// Compare explicit distributions with identical session settings and ASIX bytes.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import { arch, cpus, platform } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { measureSessions } from "./session-measure.mjs";

const [
  baselineDist,
  candidateDist,
  indexPath,
  output,
  baselineCommit,
  candidateCommit,
  engine = "auto",
] = process.argv.slice(2);
if (
  !output ||
  ![baselineCommit, candidateCommit].every((id) =>
    /^[a-f0-9]{40}$/.test(id ?? ""),
  ) ||
  !["auto", "transposed-blocked"].includes(engine)
)
  throw new Error(
    "Usage: compare-session.mjs BASELINE_DIST CANDIDATE_DIST INPUT_ASIX OUTPUT_JSON BASELINE_COMMIT CANDIDATE_COMMIT [auto|transposed-blocked]",
  );

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function load(directory, commit) {
  const root = pathToFileURL(`${resolve(directory)}/`);
  const artifacts = {};
  for (const name of [
    "node.mjs",
    "node/asearch_wasm.js",
    "node/asearch_wasm_bg.wasm",
  ])
    artifacts[name] = sha(await readFile(new URL(name, root)));
  return {
    api: await import(new URL("node.mjs", root)),
    identity: { commit, artifacts },
  };
}

if ((await stat(indexPath)).size > 256 * 1024 * 1024)
  throw new RangeError("Index exceeds 256 MiB");
const bytes = await readFile(indexPath);
const baseline = await load(baselineDist, baselineCommit);
const candidate = await load(candidateDist, candidateCommit);
const root = fileURLToPath(new URL("../../", import.meta.url));
const harness = {};
for (const name of ["compare-session.mjs", "session-measure.mjs"])
  harness[name] = sha(await readFile(new URL(name, import.meta.url)));
const report = {
  recordedAtUtc: new Date().toISOString(),
  harnessCommit: execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim(),
  harnessDirty: Boolean(
    execFileSync("git", ["status", "--porcelain"], {
      cwd: root,
      encoding: "utf8",
    }).trim(),
  ),
  harness,
  node: process.version,
  v8: process.versions.v8,
  os: platform(),
  arch: arch(),
  cpu: cpus()[0]?.model,
  baseline: baseline.identity,
  candidate: candidate.identity,
  corpusSha256: sha(bytes),
  result: measureSessions(baseline.api, bytes, {
    candidateApi: candidate.api,
    baselineEngine: engine,
    candidateEngine: engine,
  }),
};
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(
  JSON.stringify({
    baseline: report.result.baseline,
    candidate: report.result.candidate,
  }),
);
