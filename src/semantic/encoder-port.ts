/** Bounds serial, non-interruptible inference requests and retires failed Workers. */
export class EncoderPort {
  private worker: Worker | undefined;
  private serial = 0;
  private readonly url: URL;
  private readonly base: URL;
  private readonly expected: string;

  constructor(url: URL, base: URL, expected: string) {
    this.url = url;
    this.base = base;
    this.expected = expected;
  }

  dispose() {
    this.worker?.terminate();
    this.worker = undefined;
  }

  async encode(text: string): Promise<Float32Array> {
    this.worker ??= new Worker(this.url, { type: "module" });
    const worker = this.worker,
      id = ++this.serial;
    return new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        clearTimeout(timer);
        worker.onmessage = null;
        worker.onerror = null;
        worker.removeEventListener("messageerror", decodingFailure);
      };
      const fail = (message: string) => {
        if (settled) return;
        settled = true;
        cleanup();
        worker.terminate();
        if (this.worker === worker) this.worker = undefined;
        reject(new Error(message));
      };
      const decodingFailure = () =>
        fail("Encoder response could not be decoded");
      const timer = setTimeout(() => fail("Encoder timeout"), 120000);
      worker.addEventListener("messageerror", decodingFailure);
      worker.onerror = (event) => {
        event.preventDefault();
        fail("Encoder Worker stopped");
      };
      worker.onmessage = (event) => {
        if (settled || event.data.id !== id) return;
        if (event.data.error) {
          fail(String(event.data.error));
          return;
        }

        if (
          event.data.profile !== this.expected ||
          !(event.data.vector instanceof Float32Array) ||
          event.data.vector.length !== 256 ||
          !event.data.vector.every(Number.isFinite)
        ) {
          fail("Encoder profile/output mismatch");
          return;
        }

        settled = true;
        cleanup();
        resolve(event.data.vector);
      };

      try {
        worker.postMessage({ id, text, role: "query", base: this.base.href });
      } catch {
        fail("Encoder request could not be sent");
      }
    });
  }
}
