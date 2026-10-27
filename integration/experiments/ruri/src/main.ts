/** Exposes a serial browser probe and renders only text diagnostics. */
import type { Role } from "./policy.ts";

class Probe {
  private worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  });
  private sequence = 0;
  private busy = false;

  async request(
    text?: string,
    role: Role = "query",
  ): Promise<Record<string, unknown>> {
    if (this.busy) throw new Error("Probe is busy");
    this.busy = true;
    const id = ++this.sequence;
    const start = performance.now();
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        this.worker.onmessage = null;
        this.worker.onerror = null;
        this.busy = false;
      };
      const fail = (message: string) => {
        this.worker.terminate();
        cleanup();
        this.worker = new Worker(new URL("./worker.ts", import.meta.url), {
          type: "module",
        });
        reject(new Error(message));
      };
      const timer = setTimeout(() => fail("Inference timeout"), 120_000);
      this.worker.onerror = (event) => fail(event.message);
      this.worker.onmessage = (event) => {
        if (event.data.id !== id) return;
        cleanup();
        if (event.data.error) reject(new Error(event.data.error));
        else {
          const response = {
            ...event.data,
            roundTripMs: performance.now() - start,
          };
          if (response.vector instanceof Float32Array)
            response.vector = Array.from(response.vector);
          resolve(response);
        }
      };
      this.worker.postMessage({
        id,
        ...(text === undefined ? {} : { text, role }),
      });
    });
  }
}

const probe = new Probe();
Object.assign(globalThis, { ruriProbe: probe });
const form = document.querySelector("form");
const input = document.querySelector("input");
const output = document.querySelector("pre");
if (!form || !input || !output) throw new Error("Missing probe controls");
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  output.textContent = "Encoding…";
  try {
    const response = await probe.request(input.value);
    output.textContent = JSON.stringify(response, null, 2);
  } catch (error) {
    output.textContent = String(error);
  }
});
