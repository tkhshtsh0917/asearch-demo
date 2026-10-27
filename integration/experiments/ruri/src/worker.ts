/** Serializes experimental inference and returns errors without terminating the worker. */

import { loadEncoder } from "./encoder.ts";
import type { Role } from "./policy.ts";
import { profileDescription } from "./profile.ts";

let encoder: Awaited<ReturnType<typeof loadEncoder>> | undefined;
let running = false;
self.onmessage = async (
  event: MessageEvent<{
    id: number;
    text?: string;
    role?: Role;
    dispose?: boolean;
    base?: string;
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
    encoder ??= await loadEncoder(event.data.base);
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify(profileDescription)),
    );
    const profile = Array.from(new Uint8Array(digest), (n) =>
      n.toString(16).padStart(2, "0"),
    ).join("");
    if (text === undefined)
      self.postMessage({ id, initialization: encoder.initialization, profile });
    else {
      const result = await encoder.encode(text, role ?? "query");
      self.postMessage({ id, profile, ...result }, [result.vector.buffer]);
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
