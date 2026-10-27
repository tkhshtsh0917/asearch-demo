/** Runs exact native/WASM round trips and failure recovery in emulator-level browsers. */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, devices, firefox, webkit } from "@playwright/test";
import { preview } from "vite";
import type { Harness } from "../src/harness.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const choice = process.argv[2] ?? "chromium";
const options = {
  chromium: { engine: chromium, context: {} },
  firefox: { engine: firefox, context: {} },
  webkit: { engine: webkit, context: {} },
  "android-profile": { engine: chromium, context: devices["Pixel 7"] },
  "iphone-profile": { engine: webkit, context: devices["iPhone 13"] },
};
if (!(choice in options)) throw new Error("Unknown browser profile");
const selected = options[choice as keyof typeof options];
const server = await preview({
  root,
  preview: { host: "127.0.0.1", port: 4199, strictPort: true },
});
const browser = await selected.engine.launch();
try {
  const context = await browser.newContext(selected.context);
  const requests: string[] = [];
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (
      url.origin !== "http://127.0.0.1:4199" ||
      url.search ||
      route.request().method() !== "GET"
    ) {
      requests.push(url.origin + url.pathname);
      return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:4199");
  await page.waitForFunction(() => "vectorHarness" in globalThis);
  const results = await page.evaluate(async () => {
    const api = (globalThis as unknown as { vectorHarness: Harness })
      .vectorHarness;
    const c = await api.create(),
      other = await api.create();
    const { native: raw } = await api.raw();
    try {
      const base = await api.prepare(c, "base");
      c.adopt(base);
      const first = await api.query(c, base);
      const updated = await api.prepare(c, "updated");
      c.adopt(updated);
      const changed = await api.query(c, updated);
      const filtered = await api.query(c, updated, [9]);
      const empty = await api.query(c, updated, []);
      const compact = await api.prepare(c, "compact");
      c.adopt(compact);
      const compacted = await api.query(c, compact);
      c.adopt(base);
      const restored = await api.query(c, base);
      const repeated = await api.prepare(c, "base");
      if (repeated !== base)
        throw new Error("Repeated publication did not reuse branded handle");
      const reject = async (action: () => unknown) => {
        try {
          await action();
        } catch {
          return;
        }
        throw new Error("Expected boundary rejection");
      };
      let coercions = 0;
      const trap = Object.defineProperty({}, "valueOf", {
        get() {
          coercions++;
          throw new Error("coercion hook");
        },
      });
      await reject(() => api.raw(trap));
      await reject(() => raw.begin_input(trap as number, 1));
      raw.begin_input(1, 1);
      await reject(() => raw.append_input(trap as number));
      raw.begin_input(1, 1);
      raw.cancel_input();
      for (const value of [
        trap,
        "1",
        null,
        [],
        NaN,
        Infinity,
        -1,
        0.5,
        4_294_967_296,
      ]) {
        await reject(() => raw.adopt(value as number));
        await reject(() => raw.release(value as number));
        await reject(() => raw.snapshot_info(value as number));
      }
      if (coercions !== 0) throw new Error("Raw ABI invoked numeric coercion");

      // Exercise real allocation failure using unfilled, finite upload reservations.
      const reservations: Awaited<ReturnType<Harness["raw"]>>[] = [];
      let allocationRecovered = false,
        allocationLinearBytes = 0;
      try {
        const payload = new TextEncoder().encode(
          JSON.stringify({
            schema: 1,
            space: "0".repeat(64),
            revision: "0".repeat(64),
            generation: "0",
            artifacts: [
              {
                sha256: "0".repeat(64),
                bytes: "134217728",
                generation: "0",
                revision: "0".repeat(64),
                parent: null,
                url: "reservation.vecx",
              },
            ],
          }),
        );
        for (let i = 0; i < 6; i++) {
          const reservation = await api.raw(true);
          reservations.push(reservation);
          const store = reservation.native;
          store.begin_input(1, payload.length);
          new Uint8Array(
            reservation.memory.buffer,
            store.upload_pointer(),
            payload.length,
          ).set(payload);
          store.append_input(payload.length);
          store.finish_input();
          try {
            store.begin_artifact();
          } catch (error) {
            if (!String(error).startsWith("AllocationFailure:")) throw error;
            if (JSON.parse(store.resources()).staging_reserved_bytes !== 0)
              throw new Error("Failed allocation retained staging");
            allocationRecovered = true;
            allocationLinearBytes = reservation.memory.buffer.byteLength;
            break;
          }
        }
      } finally {
        for (const reservation of reservations) reservation.native.free();
      }
      if (!allocationRecovered || allocationLinearBytes > 512 * 1024 * 1024)
        throw new Error("Finite module allocation was not recoverable");
      await reject(() => api.query(other, base));
      await reject(() => c.search(base, new Float32Array([0, 0, 0]), 0));
      await reject(() => c.search(base, new Float32Array([NaN, 0, 0]), 0));
      await reject(() => c.search(base, new Float32Array([1, 0]), 0));
      await reject(() => c.search(base, new Float32Array([1, 0, 0]), NaN));
      await reject(() => api.query(c, base, [9, 1]));
      class Custom extends Float32Array {
        override get buffer(): ArrayBuffer {
          throw new Error("custom buffer");
        }
        override get byteLength(): number {
          throw new Error("custom length");
        }
      }
      const subclass = await c.search(base, new Custom([1, 0, 0]));
      const detached = new Float32Array([1, 0, 0]);
      structuredClone(detached, { transfer: [detached.buffer] });
      await reject(() => c.search(base, detached));
      const bytes = new Uint8Array(
        await (await fetch("/fixtures/base.json")).arrayBuffer(),
      );
      const bad = JSON.parse(new TextDecoder().decode(bytes));
      bad.artifacts[0].sha256 = "0".repeat(64);
      await reject(() =>
        c.prepare(
          new TextEncoder().encode(JSON.stringify(bad)),
          async function* () {
            yield new Uint8Array(
              await (await fetch("/fixtures/base.vecx")).arrayBuffer(),
            );
          },
        ),
      );
      const abort = new AbortController();
      abort.abort();
      await reject(() =>
        c.search(
          base,
          new Float32Array([1, 0, 0]),
          10,
          undefined,
          abort.signal,
        ),
      );
      const recovered = await api.query(c, base);
      c.release(updated);
      await reject(() => api.query(c, updated));
      c.adopt(compact);
      await api.query(c, compact);
      const resources = c.resources();
      if (
        resources.staging_reserved_bytes !== 0 ||
        resources.search_scratch_bytes !== 0
      )
        throw new Error("Task allocations retained");
      return {
        first,
        changed,
        filtered,
        empty,
        compacted,
        restored,
        subclass,
        recovered,
        resources,
        allocation: {
          recovered: allocationRecovered,
          linearBytes: allocationLinearBytes,
        },
      };
    } finally {
      c.dispose();
      other.dispose();
      raw.free();
    }
  });
  const oracle = JSON.parse(
    await readFile(
      new URL("../public/fixtures/oracles.json", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(results.first.candidates, oracle.base.candidates);
  assert.deepEqual(results.changed.candidates, oracle.updated.candidates);
  assert.deepEqual(results.compacted.candidates, oracle.compact.candidates);
  for (const result of [results.restored, results.recovered, results.subclass])
    assert.deepEqual(result.candidates, oracle.base.candidates);
  assert.deepEqual(results.empty.candidates, []);
  assert.deepEqual(
    results.filtered.candidates.map((c) => c.id),
    [9],
  );
  assert.equal(results.resources.staging_reserved_bytes, 0);
  assert.equal(results.resources.search_scratch_bytes, 0);
  assert.deepEqual(requests, []);
  assert.deepEqual(errors, []);
  await mkdir(new URL("../results/", import.meta.url), { recursive: true });
  await writeFile(
    new URL(`../results/${choice}.json`, import.meta.url),
    `${JSON.stringify({ browser: browser.version(), profile: choice, release: JSON.parse(await readFile(new URL("../.artifacts/release.json", import.meta.url), "utf8")), results }, null, 2)}\n`,
  );
  process.stdout.write(
    `${choice}: native/WASM exact results, deltas, compaction, restore and error recovery passed.\n`,
  );
} finally {
  await browser.close();
  await new Promise<void>((resolve) =>
    server.httpServer.close(() => resolve()),
  );
}
