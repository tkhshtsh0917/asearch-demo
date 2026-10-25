/** Controls response delivery and app render frames without replacing the DOM renderer. */
import type { Request, Response } from "../../src/shared/protocol.ts";

type Query = Extract<Request, { kind: "query" }>;
interface QueryHarness {
  holdResponses: boolean;
  holdPaint: boolean;
  requests: { worker: Worker; request: Query }[];
  replies: number;
  frames: number;
  reply(index?: number, epoch?: number): void;
  fail(index?: number, message?: string, epoch?: number): void;
  operationError(message: string): void;
  paint(): void;
}

declare global {
  interface Window {
    __queryHarness: QueryHarness;
  }
}

/** Uses real UI response handlers; only the Worker and scheduled render delivery are controlled. */
export function installQueryWorker(): void {
  const frames: FrameRequestCallback[] = [];
  const nativeFrame = window.requestAnimationFrame.bind(window);
  let delivering = false;
  const harness: QueryHarness = {
    holdResponses: false,
    holdPaint: false,
    requests: [],
    replies: 0,
    get frames() {
      return frames.length;
    },
    reply(index = harness.requests.length - 1, epoch = 0) {
      const entry = harness.requests[index];
      if (!entry) throw new Error("Missing held query");
      const { request, worker } = entry;
      (worker as unknown as ControlledWorker).emit({
        kind: "results",
        id: request.id,
        epoch,
        total: 85,
        totalIsExact: false,
        facets: {
          articles: [{ title: `記事:${request.pattern}`, count: 85 }],
          changes: [
            { kind: "unchanged", count: 85 },
            { kind: "added", count: 0 },
            { kind: "updated", count: 0 },
          ],
        },
        elapsed: 0,
        stats: null,
        rows: [
          {
            key: 1,
            text: `候補:${request.pattern}`,
            title: `記事:${request.pattern}`,
            url: "",
            level: 0,
            spans: [],
          },
        ],
      });
      harness.replies++;
    },
    fail(index = harness.requests.length - 1, message = "検索失敗", epoch = 0) {
      const entry = harness.requests[index];
      if (!entry) throw new Error("Missing held query");
      (entry.worker as unknown as ControlledWorker).emit({
        kind: "error",
        id: entry.request.id,
        epoch,
        message,
        fatal: false,
      });
    },
    operationError(message) {
      const entry = harness.requests.at(-1);
      if (!entry) throw new Error("Missing active Worker");
      (entry.worker as unknown as ControlledWorker).emit({
        kind: "error",
        message,
        fatal: false,
      });
    },
    paint() {
      const frame = frames.shift();
      if (!frame) throw new Error("Missing held render");
      nativeFrame(frame);
    },
  };
  window.__queryHarness = harness;
  window.requestAnimationFrame = (frame) => {
    if (delivering && harness.holdPaint) return frames.push(frame);
    return nativeFrame(frame);
  };

  class ControlledWorker extends EventTarget {
    onmessage: ((event: MessageEvent<Response>) => void) | null = null;

    constructor() {
      super();
      queueMicrotask(() => this.emit({ kind: "boot" }));
    }

    emit(message: Response) {
      const event = new MessageEvent("message", { data: message });
      delivering = true;
      try {
        this.dispatchEvent(event);
        this.onmessage?.(event);
      } finally {
        delivering = false;
      }
    }

    postMessage(request: Request) {
      if (request.kind === "init") {
        queueMicrotask(() =>
          this.emit({
            kind: "state",
            stage: 0,
            epoch: 0,
            pending: null,
            count: 10000,
            busy: false,
            segments: 1,
            updates: { added: 0, updated: 0, removed: 0 },
            creator: "Test corpus",
            changes: "Test snapshot",
          }),
        );
      }
      if (request.kind === "query") {
        harness.requests.push({ worker: this as unknown as Worker, request });
        if (!harness.holdResponses) harness.reply();
      }
    }

    terminate() {
      // Retained callbacks can still be delivered to test abandoned Worker rejection.
    }
  }
  window.Worker = ControlledWorker as unknown as typeof Worker;
}
