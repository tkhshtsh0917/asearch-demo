// Compare explicit distributions with identical session settings and ASIX bytes.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import { arch, cpus, platform } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compareBrowserSessions } from "./browser-session.mjs";
import { measureComparison } from "./operation-measure.mjs";

const [
  baselineDist,
  candidateDist,
  indexPath,
  output,
  baselineCommit,
  candidateCommit,
  engine = "auto",
  mode = "node",
  workloadPath,
] = process.argv.slice(2);
if (
  !["node", "browser"].includes(mode) ||
  !output ||
  ![baselineCommit, candidateCommit].every((id) =>
    /^[a-f0-9]{40}$/.test(id ?? ""),
  ) ||
  !["auto", "transposed-blocked"].includes(engine)
)
  throw new Error(
    "Usage: compare-session.mjs BASELINE_DIST CANDIDATE_DIST INPUT_ASIX OUTPUT_JSON BASELINE_COMMIT CANDIDATE_COMMIT [auto|transposed-blocked] [node|browser] [WORKLOAD_JSON]",
  );

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function load(directory, commit) {
  const root = pathToFileURL(`${resolve(directory)}/`);
  const artifacts = {};
  for (const name of [
    "web.mjs",
    "web/asearch_wasm.js",
    "web/asearch_wasm_bg.wasm",
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
let measurement = {};
let workloadHash;
if (workloadPath) {
  if ((await stat(workloadPath)).size > 1024 * 1024)
    throw new RangeError("Workload exceeds 1 MiB");
  const workloadBytes = await readFile(workloadPath);
  workloadHash = sha(workloadBytes);
  const { inputs, runs, rounds, warmup, kind, primer, pattern, iterations } =
    JSON.parse(workloadBytes.toString("utf8"));
  measurement = Object.fromEntries(
    Object.entries({
      inputs,
      runs,
      rounds,
      warmup,
      kind,
      primer,
      pattern,
      iterations,
    }).filter(([, value]) => value !== undefined),
  );
}
const baseline = await load(baselineDist, baselineCommit);
const candidate = await load(candidateDist, candidateCommit);
const root = fileURLToPath(new URL("../../", import.meta.url));
const harness = {};
for (const name of [
  "compare-session.mjs",
  "session-measure.mjs",
  "operation-measure.mjs",
  "timing-summary.mjs",
  "browser-session.mjs",
  "server.mjs",
  "start-server.mjs",
])
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
  mode,
  node: process.version,
  v8: process.versions.v8,
  os: platform(),
  arch: arch(),
  cpu: cpus()[0]?.model,
  baseline: baseline.identity,
  candidate: candidate.identity,
  corpusSha256: sha(bytes),
  lockSha256: sha(
    await readFile(new URL("../../pnpm-lock.yaml", import.meta.url)),
  ),
  workloadSha256: workloadHash ?? sha(JSON.stringify(measurement)),
  result:
    mode === "browser"
      ? await compareBrowserSessions(
          baselineDist,
          candidateDist,
          indexPath,
          sha(bytes),
          engine,
          measurement,
        )
      : await measureComparison(baseline.api, bytes, {
          ...measurement,
          candidateApi: candidate.api,
          baselineEngine: engine,
          candidateEngine: engine,
        }),
};
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
const summaries = (
  Array.isArray(report.result) ? report.result : [report.result]
).map(({ name, baseline, candidate }) => ({
  name: name ?? "node",
  baseline,
  candidate,
}));
console.log(JSON.stringify(summaries));
