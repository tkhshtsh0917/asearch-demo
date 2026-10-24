/** Sends original questions to the offline Rust analyzer and verifies its output. */
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
import type { Question } from "../../src/shared/catalog.ts";
import { digest } from "./cache.ts";
import { documents } from "./documents.ts";
import { nativeCLI, runNative } from "./native.ts";
import {
  dictionaryPath,
  resourceDirectory,
  resourceLock,
  root,
} from "./pins.ts";

/** Rejects stale preparation instead of silently mixing resource versions. */
function prepared() {
  const info = JSON.parse(
    readFileSync(new URL(".analysis/ready.json", root), "utf8"),
  ) as {
    resourceLockSha256: string;
    compiledSha256: string;
    compiledFile: string;
    analyzerCliSha256: string;
  };
  if (
    info.resourceLockSha256 !==
      digest(readFileSync(new URL("resources.lock.json", import.meta.url))) ||
    info.analyzerCliSha256 !== digest(readFileSync(nativeCLI)) ||
    !/^[a-f0-9]{64}$/.test(info.compiledSha256) ||
    info.compiledFile !== `${info.compiledSha256}.resources.json` ||
    digest(readFileSync(new URL(info.compiledFile, resourceDirectory))) !==
      info.compiledSha256
  )
    throw new Error("Analysis preparation is stale; run analysis:prepare");
  return info;
}

/** Builds ASIX-compatible texts with one native tokenizer per publication snapshot. */
export function analyzeQuestions(rows: Question[]) {
  const info = prepared();
  const input = rows
    .map(({ key, text }) => JSON.stringify({ key, texts: [text] }))
    .join("\n");
  if (Buffer.byteLength(input) > 16 * 1024 * 1024 || rows.length > 20000)
    throw new Error("Analysis input exceeds byte or record limit");
  const directory = mkdtempSync(join(tmpdir(), "asearch-analysis-"));
  try {
    const source = join(directory, "questions.jsonl"),
      output = join(directory, "documents.jsonl");
    writeFileSync(source, `${input}\n`);
    runNative([
      "analyze",
      fileURLToPath(dictionaryPath()),
      fileURLToPath(new URL(info.compiledFile, resourceDirectory)),
      fileURLToPath(new URL("policy.json", import.meta.url)),
      source,
      output,
    ]);
    if (statSync(output).size > 64 * 1024 * 1024)
      throw new Error("Analysis output byte limit");
    return documents(
      rows,
      readFileSync(output, "utf8")
        .trimEnd()
        .split("\n")
        .map((line) => JSON.parse(line)),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/** Records exact resource/compiler identities without machine-specific paths. */
export async function analysisProvenance() {
  return {
    format: "asearch-demo-analysis/1",
    resources: resourceLock,
    policy: JSON.parse(
      readFileSync(new URL("policy.json", import.meta.url), "utf8"),
    ),
    policySha256: digest(readFileSync(new URL("policy.json", import.meta.url))),
    ...prepared(),
  };
}
