/** Captures one immutable analysis generation for all batches and their provenance. */
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Doc } from "asearch-wasm";
import type { Question } from "../../src/shared/catalog.ts";
import {
  MAX_QUERY_RULE_BYTES,
  type QueryRules,
  queryRules,
} from "../../src/shared/query.ts";
import { digest } from "./cache.ts";
import { documents } from "./documents.ts";
import {
  type NativeRunner,
  nativeCLI,
  runNative,
  writeNative,
} from "./native.ts";
import {
  dictionaryPath,
  type ResourceLock,
  type ResourcePaths,
  resourcePaths,
} from "./pins.ts";

interface Prepared {
  resourceLockSha256: string;
  compiledSha256: string;
  compiledFile: string;
  analyzerCliSha256: string;
}

export interface AnalysisProvenance extends Prepared {
  format: "asearch-demo-analysis/1";
  resources: ResourceLock;
  policy: unknown;
  policySha256: string;
}

export interface Analysis {
  analyze(rows: Question[]): Doc[];
  queryRules(rows: Question[]): QueryRules;
  provenance(): AnalysisProvenance;
}

export interface AnalysisPaths extends ResourcePaths {
  policy: URL;
  cli: string;
}

const defaults: AnalysisPaths = {
  ...resourcePaths,
  policy: new URL("policy.json", import.meta.url),
  cli: nativeCLI,
};

/** Rejects mismatched preparation using the captured lock, not a later disk version. */
function prepared(paths: AnalysisPaths, lock: Uint8Array, cli: Uint8Array) {
  const info = JSON.parse(readFileSync(paths.ready, "utf8")) as Prepared;
  if (
    info.resourceLockSha256 !== digest(lock) ||
    info.analyzerCliSha256 !== digest(cli) ||
    !/^[a-f0-9]{64}$/.test(info.compiledSha256) ||
    info.compiledFile !== `${info.compiledSha256}.resources.json`
  )
    throw new Error("Analysis preparation is stale; run analysis:prepare");

  const compiled = readFileSync(new URL(info.compiledFile, paths.directory));
  if (digest(compiled) !== info.compiledSha256)
    throw new Error("Analysis preparation is stale; run analysis:prepare");
  return { info, compiled };
}

/** Captures bytes once; later pin, policy, ready and CLI updates affect only new generations. */
export function createAnalysis(
  paths: AnalysisPaths = defaults,
  execute: NativeRunner = runNative,
): Analysis {
  const lock = readFileSync(paths.lock),
    cli = readFileSync(paths.cli);
  const resources: ResourceLock = JSON.parse(lock.toString());
  const { info, compiled } = prepared(paths, lock, cli);
  const policy = readFileSync(paths.policy);
  const provenance: AnalysisProvenance = {
    ...info,
    format: "asearch-demo-analysis/1",
    resources,
    policy: JSON.parse(policy.toString()),
    policySha256: digest(policy),
  };
  const dictionary = fileURLToPath(dictionaryPath(resources, paths.directory));

  return {
    analyze: (rows) =>
      analyzeBatch(rows, dictionary, cli, compiled, policy, execute),
    queryRules: (rows) =>
      queryRules(
        JSON.parse(
          nativeBatch(
            rows,
            dictionary,
            cli,
            compiled,
            policy,
            execute,
            "query-rules",
          ),
        ),
      ),
    provenance: () => structuredClone(provenance),
  };
}

/** Runs a batch from private captured files while the content-addressed dictionary stays immutable. */
function analyzeBatch(
  rows: Question[],
  dictionary: string,
  cli: Uint8Array,
  compiled: Uint8Array,
  policy: Uint8Array,
  execute: NativeRunner,
): Doc[] {
  if (rows.length === 0) return [];
  return documents(
    rows,
    nativeBatch(rows, dictionary, cli, compiled, policy, execute, "analyze")
      .trimEnd()
      .split("\n")
      .map((line) => JSON.parse(line)),
  );
}

/** Runs both exports against the same captured CLI, dictionary, resources and policy. */
function nativeBatch(
  rows: Question[],
  dictionary: string,
  cli: Uint8Array,
  compiled: Uint8Array,
  policy: Uint8Array,
  execute: NativeRunner,
  command: "analyze" | "query-rules",
): string {
  if (rows.length > 20000) throw new Error("Analysis record limit");
  const input = `${rows.map(({ key, text }) => JSON.stringify({ key, texts: [text] })).join("\n")}\n`;
  if (Buffer.byteLength(input) > 16 * 1024 * 1024)
    throw new Error("Analysis input byte limit");

  const directory = mkdtempSync(join(tmpdir(), "asearch-analysis-"));
  try {
    const source = join(directory, "questions.jsonl"),
      output = join(directory, "documents.jsonl"),
      resourceFile = join(directory, "resources.json"),
      policyFile = join(directory, "policy.json");
    writeFileSync(source, input);
    writeFileSync(resourceFile, compiled);
    writeFileSync(policyFile, policy);
    execute(
      [command, dictionary, resourceFile, policyFile, source, output],
      writeNative(directory, cli),
    );
    if (
      statSync(output).size >
      (command === "query-rules" ? MAX_QUERY_RULE_BYTES : 64 * 1024 * 1024)
    )
      throw new Error("Analysis output byte limit");
    return readFileSync(output, "utf8");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
