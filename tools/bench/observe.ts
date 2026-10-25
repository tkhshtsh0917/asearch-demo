/** Correlates current Worker responses with their accepted DOM mutations in test pages. */
import type { Request, Response } from "../../src/shared/protocol.ts";

interface Sample {
  sequence: number;
  pattern: string;
  workerMs: number;
  roundTripMs: number;
  domMs: number;
}
export interface Observation {
  readyMs: number | null;
  queries: number;
  samples: Sample[];
  errors: string[];
}

/** Installs once per navigation; superseded requests and Workers never complete a sample. */
export function installObservation(): void {
  if (Object.hasOwn(window, "__asearchBench")) return;
  const observation: Observation = {
    readyMs: null,
    queries: 0,
    samples: [],
    errors: [],
  };
  Object.assign(window, { __asearchBench: observation });

  interface Sent {
    worker: Worker;
    id: number;
    sequence: number;
    pattern: string;
    started: number;
  }
  let active: Worker | undefined;
  let epoch: number | undefined;
  let latest: Sent | undefined;
  let pending: { request: Sent; sample: Sample } | undefined;
  const invalidate = () => {
    latest = undefined;
    pending = undefined;
  };
  const NativeWorker = window.Worker;

  window.Worker = class extends NativeWorker {
    constructor(...args: ConstructorParameters<typeof Worker>) {
      super(...args);
      active = this;
      epoch = undefined;
      invalidate();
      this.addEventListener("error", () => {
        if (this === active) invalidate();
      });
      this.addEventListener("message", (event: MessageEvent<Response>) => {
        if (this !== active) return;
        const message = event.data;
        if (message.kind === "error") {
          observation.errors.push(message.message);
          pending = undefined;
        }
        if (message.kind === "state") {
          epoch = message.epoch;
          pending = undefined;
        }
        if (
          message.kind !== "results" ||
          !latest ||
          message.id !== latest.id ||
          message.epoch !== epoch
        )
          return;
        pending = {
          request: latest,
          sample: {
            sequence: latest.sequence,
            pattern: latest.pattern,
            workerMs: message.elapsed,
            roundTripMs: performance.now() - latest.started,
            domMs: 0,
          },
        };
      });
    }

    override postMessage(
      message: unknown,
      options?: StructuredSerializeOptions | Transferable[],
    ): void {
      const request = message as Request;
      if (this === active && request.kind === "query") {
        pending = undefined;
        latest = {
          worker: this,
          id: request.id,
          sequence: ++observation.queries,
          pattern: request.pattern,
          started: performance.now(),
        };
      }
      super.postMessage(
        message,
        Array.isArray(options) ? { transfer: options } : options,
      );
    }
  };

  // Input invalidates old responses before the app coalesces the next Worker request.
  for (const name of ["input", "compositionstart"])
    document.addEventListener(
      name,
      (event) => {
        if (event.target === document.querySelector("#query")) invalidate();
      },
      true,
    );

  new MutationObserver((entries) => {
    if (
      observation.readyMs === null &&
      document.querySelector("#status")?.textContent?.includes("検索できます")
    )
      observation.readyMs = performance.now();
    const metrics = document.querySelector("#metrics");
    if (
      !pending ||
      pending.request !== latest ||
      pending.request.worker !== active ||
      !metrics ||
      !entries.some(
        (entry) => entry.target === metrics || metrics.contains(entry.target),
      )
    )
      return;
    pending.sample.domMs = performance.now() - pending.request.started;
    observation.samples.push(pending.sample);
    pending = undefined;
  }).observe(document, {
    subtree: true,
    childList: true,
    characterData: true,
  });
}
