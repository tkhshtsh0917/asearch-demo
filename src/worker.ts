/// <reference lib="webworker" />
import {
  AsearchIndex,
  diffManifest,
  IntentIndex,
  type Manifest,
  ready,
  type SearchSession,
} from "asearch-wasm";
import {
  assetName,
  catalog,
  type Question,
  type Release,
  release,
} from "./shared/catalog.ts";
import type { Request, Response } from "./shared/protocol.ts";
import { jsonAsset, segmentStream } from "./worker/load.ts";
import { intents, search, searchOptions } from "./worker/search.ts";

const scope = self as DedicatedWorkerGlobalScope;
const post = (message: Response) => scope.postMessage(message);
let base: URL,
  info: Release,
  root: AsearchIndex,
  session: SearchSession,
  intent: IntentIndex,
  current: Manifest;
let questions = new Map<number, Question>(),
  stage = 0,
  epoch = 0,
  busy = false,
  initialized = false;
let last: Extract<Request, { kind: "query" }> | undefined;
const limits = { maxPatternUnits: 128, maxWorkingBytes: 64 * 1024 * 1024 };
function state() {
  post({
    kind: "state",
    stage,
    count: questions.size,
    busy,
    creator: info.attribution.creator,
    changes: info.attribution.changes,
  });
}
async function candidate(index: number) {
  const descriptor = info.stages[index];
  if (!descriptor) throw new Error("Missing stage");
  const manifest = (await jsonAsset(base, descriptor.manifest)) as Manifest;
  diffManifest(undefined, manifest);
  if (
    manifest.indexId !== "auto-wiki-qa-questions" ||
    manifest.generation !== index + 1 ||
    manifest.index.major !== 1 ||
    manifest.index.minor !== 0 ||
    manifest.index.symbol_unit !== "code-point" ||
    manifest.index.normalizer.id !== "ja-basic" ||
    manifest.index.normalizer.version !== 1 ||
    manifest.index.normalizer.options !== 31
  )
    throw new Error("Unexpected index definition");
  for (const part of manifest.segments) assetName(part.url);
  const rows = catalog(
    await jsonAsset(
      base,
      descriptor.catalog,
      8 * 1024 * 1024,
      descriptor.catalogSha256,
    ),
  );
  return { manifest, questions: new Map(rows.map((row) => [row.key, row])) };
}
function run() {
  if (last && initialized)
    post(
      search(
        last.id,
        last.pattern,
        last.mode,
        epoch,
        root,
        session,
        intent,
        questions,
      ),
    );
}
async function init(url: string) {
  if (initialized || busy) throw new Error("Already initialized");
  busy = true;
  base = new URL(url);
  if (base.origin !== scope.location.origin)
    throw new Error("Cross-origin release rejected");
  await ready;
  info = release(await jsonAsset(base, "release.json"));
  const next = await candidate(0),
    descriptor = next.manifest.segments[0];
  if (!descriptor || next.manifest.segments.length !== 1)
    throw new Error("Invalid initial manifest");
  root = await AsearchIndex.fromStream(
    await segmentStream(base, descriptor.url),
    {
      expected: descriptor,
      profile: "ideal",
      normalizer: "ja-basic-v1",
      limits,
    },
  );
  try {
    session = root.session({
      ...searchOptions,
      maxCacheBytes: 16 * 1024 * 1024,
    });
    intent = IntentIndex.fromEntries(intents, {
      profile: "ideal",
      normalizer: "ja-basic-v1",
      limits,
    });
  } catch (error) {
    root.free();
    throw error;
  }
  current = next.manifest;
  questions = next.questions;
  initialized = true;
  busy = false;
  state();
  run();
}
async function advance() {
  if (!initialized || busy || stage >= 2) return;
  busy = true;
  state();
  try {
    const next = await candidate(stage + 1),
      change = diffManifest(current, next.manifest);
    if (change.kind === "append" && change.add.length === 1) {
      const part = change.add[0];
      if (!part) throw new Error("Missing delta");
      await root.addSegment(await segmentStream(base, part.url), part);
    } else if (change.kind === "replace" || change.kind === "append") {
      const part = next.manifest.segments[0];
      if (!part || next.manifest.segments.length !== 1)
        throw new Error("Expected one compacted segment");
      const sources = [
        { expected: part, source: await segmentStream(base, part.url) },
      ];
      await root.replaceSegments(sources);
    } else if (change.kind === "stale") throw new Error("Stale manifest");
    current = next.manifest;
    questions = next.questions;
    stage++;
    epoch++;
  } finally {
    busy = false;
    state();
  }
  run();
}
scope.onmessage = (event: MessageEvent<Request>) => {
  const request = event.data;
  void (async () => {
    if (request.kind === "init") {
      await init(request.base);
      return;
    }
    if (request.kind === "query") {
      if (
        !Number.isSafeInteger(request.id) ||
        request.id < 1 ||
        typeof request.pattern !== "string" ||
        request.pattern.length > 128 ||
        !["corpus", "intent"].includes(request.mode)
      )
        throw new Error("Invalid query");
      last = request;
      run();
      return;
    }
    if (request.kind === "advance") await advance();
  })().catch((error) =>
    post({
      kind: "error",
      message: error instanceof Error ? error.message : "Worker failed",
      fatal: !initialized,
      ...(request.kind === "query" ? { id: request.id } : {}),
    }),
  );
};
post({ kind: "boot" });
