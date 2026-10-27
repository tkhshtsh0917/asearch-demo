/** Serializes experimental inference and returns errors without terminating the worker. */
import { loadEncoder } from "./encoder.ts";
import type { Role } from "./policy.ts";

let encoder: Awaited<ReturnType<typeof loadEncoder>> | undefined;
let running = false;
self.onmessage = async (
  event: MessageEvent<{
    id: number;
    text?: string;
    role?: Role;
    dispose?: boolean;
  }>,
) => {
  const { id, text, role } = event.data;
  if (running) {
    self.postMessage({ id, error: "Probe is busy" });
    return;
  }
  running = true;
  try {
    if (event.data.dispose) {
      await encoder?.dispose();
      encoder = undefined;
      self.postMessage({ id, disposed: true });
      return;
    }
    encoder ??= await loadEncoder();
    if (text === undefined)
      self.postMessage({ id, initialization: encoder.initialization });
    else {
      const result = await encoder.encode(text, role ?? "query");
      self.postMessage({ id, ...result }, [result.vector.buffer]);
    }
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : "Encoder failed",
    });
  } finally {
    running = false;
  }
};
