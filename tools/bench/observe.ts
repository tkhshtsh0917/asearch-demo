/** Observes benchmark-only Worker requests, responses and accepted DOM mutations. */
interface Sample {
  pattern: string;
  workerMs: number;
  roundTripMs: number;
  domMs: number;
}
export interface Observation {
  readyMs: number | null;
  samples: Sample[];
  errors: string[];
}

export function installObservation(): void {
  const observation: Observation = {
    readyMs: null,
    samples: [],
    errors: [],
  };
  Object.assign(window, { __asearchBench: observation });
  const NativeWorker = window.Worker;
  const sent = new Map<number, { started: number; pattern: string }>();
  let accepted: { sample: Sample; started: number } | undefined;

  window.Worker = class extends NativeWorker {
    constructor(...args: ConstructorParameters<typeof Worker>) {
      super(...args);
      this.addEventListener("message", (event) => {
        const message = event.data;
        if (message.kind === "error") observation.errors.push(message.message);
        const request = sent.get(message.id);
        if (message.kind !== "results" || !request) return;
        sent.delete(message.id);
        accepted = {
          started: request.started,
          sample: {
            pattern: request.pattern,
            workerMs: message.elapsed,
            roundTripMs: performance.now() - request.started,
            domMs: 0,
          },
        };
      });
    }

    override postMessage(
      message: unknown,
      options?: StructuredSerializeOptions | Transferable[],
    ): void {
      const request = message as {
        kind?: string;
        id: number;
        pattern: string;
      };
      if (request.kind === "query") {
        sent.set(request.id, {
          started: performance.now(),
          pattern: request.pattern,
        });
      }
      super.postMessage(
        message,
        Array.isArray(options) ? { transfer: options } : options,
      );
    }
  };

  new MutationObserver((entries) => {
    if (
      observation.readyMs === null &&
      document.querySelector("#status")?.textContent?.includes("検索できます")
    )
      observation.readyMs = performance.now();
    const metrics = document.querySelector("#metrics");
    if (
      !accepted ||
      !metrics ||
      !entries.some(
        (entry) => entry.target === metrics || metrics.contains(entry.target),
      )
    )
      return;
    const request = accepted;
    request.sample.domMs = performance.now() - request.started;
    observation.samples.push(request.sample);
    accepted = undefined;
  }).observe(document, {
    subtree: true,
    childList: true,
    characterData: true,
  });
}
