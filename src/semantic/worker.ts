/// <reference lib="webworker" />
/** Serializes optional semantic work with one running request and one latest pending request. */
import { EncoderPort } from "./encoder-port.ts";
import type { SemanticReply, SemanticRequest } from "./protocol.ts";
import { eligibleIds } from "./selection.ts";
import { Publications } from "./snapshot.ts";

const scope = self as DedicatedWorkerGlobalScope;
const publications = new Publications();
let pending: Extract<SemanticRequest, { kind: "query" }> | undefined;
let running = false,
  abort: AbortController | undefined;
let encoder: EncoderPort | undefined,
  encoderIdentity = "";
const post = (reply: SemanticReply) => scope.postMessage(reply);

async function drain() {
  if (running) return;
  running = true;
  try {
    while (pending) {
      const request = pending;
      pending = undefined;
      const controller = new AbortController();
      abort = controller;
      const began = performance.now();
      try {
        if (
          !Number.isSafeInteger(request.token) ||
          request.token < 1 ||
          !request.text.trim() ||
          request.text.length > 128 ||
          !Number.isInteger(request.context.stage) ||
          request.context.stage < 0 ||
          request.context.stage > 2
        )
          throw new Error("Invalid semantic request");
        const base = new URL(request.base);
        if (base.origin !== scope.location.origin || base.search || base.hash)
          throw new Error("Invalid semantic origin");
        const prepared = await publications.prepare(
          base,
          request.context,
          controller.signal,
        );
        post({
          kind: "catalog",
          token: request.token,
          stage: request.context.stage,
          catalogSha256: request.context.catalogSha256,
          available: {
            articles: [...new Set(prepared.rows.map((q) => q.title))].sort(
              (a, b) => a.localeCompare(b, "ja"),
            ),
            changes: [
              ...new Set(
                prepared.rows.map(
                  (q) => prepared.changes.get(q.key) ?? "unchanged",
                ),
              ),
            ],
          },
        });
        const identity = `${prepared.publication.encoderProfile}:${base.href}:${prepared.publication.encoderDirectory}:${prepared.publication.encoderWorker}`;
        if (encoderIdentity !== identity) {
          encoder?.dispose();
          encoderIdentity = identity;
          encoder = new EncoderPort(
            new URL(
              `${prepared.publication.encoderDirectory}/${prepared.publication.encoderWorker}`,
              base,
            ),
            new URL(`${prepared.publication.encoderDirectory}/`, base),
            prepared.publication.encoderProfile,
          );
        }
        if (!encoder) throw new Error("Missing query encoder");
        const vector = await encoder.encode(request.text);
        controller.signal.throwIfAborted();
        const allowed = eligibleIds(
          prepared.rows,
          prepared.changes,
          request.filters,
          request.exclude,
        );
        const result = await prepared.client.search(
          prepared.handle,
          vector,
          5,
          allowed,
          controller.signal,
        );
        const byId = new Map(prepared.rows.map((q) => [q.key, q]));
        const rows = result.candidates.map((candidate) => {
          const row = byId.get(candidate.id);
          if (!row) throw new Error("Missing semantic catalog row");
          const change = prepared.changes.get(row.key);
          return {
            ...row,
            distance: candidate.distance,
            ...(change ? { change } : {}),
          };
        });
        post({
          kind: "result",
          token: request.token,
          rows,
          elapsed: performance.now() - began,
          snapshot: result.snapshot,
          stage: request.context.stage,
          catalogSha256: request.context.catalogSha256,
        });
      } catch (error) {
        if (!controller.signal.aborted)
          post({
            kind: "error",
            token: request.token,
            message:
              error instanceof Error ? error.message : "Semantic search failed",
          });
      }
    }
  } finally {
    running = false;
    abort = undefined;
  }
}
scope.onmessage = (event: MessageEvent<SemanticRequest>) => {
  abort?.abort();
  pending = event.data.kind === "query" ? event.data : undefined;
  void drain();
};
