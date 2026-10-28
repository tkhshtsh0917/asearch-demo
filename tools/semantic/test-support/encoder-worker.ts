/** Provides deterministic Worker events and tracks subscriptions without loading a model. */
import assert from "node:assert/strict";
import type { TestContext } from "node:test";

export class EncoderWorker extends EventTarget {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly decodingListeners = new Set<EventListenerOrEventListenerObject>();
  request: { id: number } | undefined;
  terminated = false;
  failSend = false;

  override addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ) {
    super.addEventListener(type, listener, options);
    if (type === "messageerror" && listener)
      this.decodingListeners.add(listener);
  }

  override removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ) {
    super.removeEventListener(type, listener, options);
    if (type === "messageerror" && listener)
      this.decodingListeners.delete(listener);
  }

  postMessage(request: { id: number }) {
    if (this.failSend) throw new Error("Controlled send failure");
    this.request = request;
  }

  terminate() {
    this.terminated = true;
  }

  decodingListener(): EventListener {
    const listener = [...this.decodingListeners][0];
    assert.equal(typeof listener, "function");
    return listener as EventListener;
  }

  reply(id = this.request?.id) {
    const vector = new Float32Array(256);
    vector[0] = 1;
    this.onmessage?.(
      new MessageEvent("message", {
        data: { id, vector, profile: "test-profile" },
      }),
    );
  }
}

export function installEncoderWorkers(t: TestContext): EncoderWorker[] {
  const original = Object.getOwnPropertyDescriptor(globalThis, "Worker");
  const workers: EncoderWorker[] = [];
  Object.defineProperty(globalThis, "Worker", {
    configurable: true,
    value: class extends EncoderWorker {
      constructor() {
        super();
        workers.push(this);
      }
    },
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "Worker", original);
    else Reflect.deleteProperty(globalThis, "Worker");
  });
  t.mock.timers.enable({ apis: ["setTimeout"] });
  return workers;
}
