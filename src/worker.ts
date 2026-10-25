/// <reference lib="webworker" />
/** Owns search handles and serializes publication-stage transitions off the UI thread. */
import {
  AsearchIndex,
  diffManifest,
  type Manifest,
  ready,
  type SearchSession,
} from "asearch-wasm";
import { type Question, type Release, release } from "./shared/catalog.ts";
import { type CatalogChanges, catalogChanges } from "./shared/changes.ts";
import type { Request, Response } from "./shared/protocol.ts";
import { MAX_QUERY_RULE_BYTES, QueryPolicy } from "./shared/query.ts";
import { jsonAsset, segmentStream } from "./worker/load.ts";
import { facetOptions } from "./worker/options.ts";
import { search } from "./worker/search.ts";
import { candidate } from "./worker/stage.ts";

const scope = self as DedicatedWorkerGlobalScope;
const post = (message: Response) => scope.postMessage(message);

let base: URL,
  info: Release,
  root: AsearchIndex,
  session: SearchSession,
  current: Manifest;
let policy: QueryPolicy;

let questions = new Map<number, Question>(),
  stage = 0,
  epoch = 0,
  busy = false,
  initialized = false;

let last: Extract<Request, { kind: "query" }> | undefined;
let updates: CatalogChanges = catalogChanges(questions, questions);
let pending: "advance" | "restore" | null = null;

const limits = { maxPatternUnits: 128, maxWorkingBytes: 64 * 1024 * 1024 };

/** Publishes metadata only for the currently adopted index and catalog. */
function state() {
  post({
    kind: "state",
    stage,
    epoch,
    pending,
    count: questions.size,
    busy,
    segments: current.segments.length,
    updates: updates.summary,
    creator: info.attribution.creator,
    changes: info.attribution.changes,
  });
}

/** Replays the latest validated query after initialization or an atomic update. */
function run() {
  if (!last || !initialized) return;
  try {
    post(
      search(last, epoch, {
        root,
        session,
        questions,
        changes: updates.byKey,
        policy,
      }),
    );
  } catch (error) {
    reportError(error, last);
  }
}

/** Attributes search failures to their request and snapshot, including update replays. */
function reportError(
  error: unknown,
  query?: Extract<Request, { kind: "query" }>,
) {
  post({
    kind: "error",
    message: error instanceof Error ? error.message : "Worker failed",
    fatal: !initialized,
    ...(query ? { id: query.id, epoch } : {}),
  });
}

/** Loads the initial segment and creates query handles before exposing readiness. */
async function init(url: string) {
  if (initialized || busy) throw new Error("Already initialized");
  busy = true;
  base = new URL(url);
  if (base.origin !== scope.location.origin)
    throw new Error("Cross-origin release rejected");

  await ready;
  info = release(await jsonAsset(base, "release.json"));
  policy = new QueryPolicy(
    await jsonAsset(
      base,
      info.queryRules.url,
      MAX_QUERY_RULE_BYTES,
      info.queryRules.sha256,
    ),
  );
  const next = await candidate(base, info, 0),
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
      ...facetOptions,
      maxCacheBytes: 16 * 1024 * 1024,
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

/** Adopts the next stage and publishes its catalog only after the index update succeeds. */
async function advance() {
  if (!initialized || busy || stage >= 2) return;
  busy = true;
  pending = "advance";
  state();

  try {
    const next = await candidate(base, info, stage + 1),
      change = diffManifest(current, next.manifest);
    const nextUpdates =
      stage === 0 ? catalogChanges(questions, next.questions) : updates;
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
    updates = nextUpdates;
    stage++;
    epoch++;
  } finally {
    busy = false;
    pending = null;
    state();
  }
  run();
}

/** Atomically restores the base snapshot while preserving query handles and input. */
async function restore() {
  if (!initialized || busy || stage === 0) return;
  busy = true;
  pending = "restore";
  state();
  try {
    const next = await candidate(base, info, 0);
    const part = next.manifest.segments[0];
    if (!part || next.manifest.segments.length !== 1)
      throw new Error("Expected one initial segment");
    await root.replaceSegments([
      { expected: part, source: await segmentStream(base, part.url) },
    ]);
    current = next.manifest;
    questions = next.questions;
    updates = catalogChanges(questions, questions);
    stage = 0;
    epoch++;
  } finally {
    busy = false;
    pending = null;
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
        request.pattern.length > 128
      )
        throw new Error("Invalid query");
      last = request;
      run();
      return;
    }
    if (request.kind === "advance") await advance();
    if (request.kind === "restore") await restore();
  })().catch((error) =>
    reportError(error, request.kind === "query" ? request : undefined),
  );
};

post({ kind: "boot" });
