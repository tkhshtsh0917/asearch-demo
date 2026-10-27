/** Serves only prepared static files with an optional shared decoded-byte rate limit. */

import { once } from "node:events";
import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

export async function staticServer(directory: string, throttle: boolean) {
  const paths = new Map<string, { path: string; bytes: number }>();
  for (const name of await readdir(directory, { recursive: true })) {
    const path = resolve(directory, name),
      info = await stat(path);
    if (info.isFile())
      paths.set(`/${name.split("\\").join("/")}`, { path, bytes: info.size });
  }
  const index = paths.get("/index.html");
  if (index) paths.set("/", index);
  const counters = { requests: 0, decodedBytesWritten: 0 };
  let nextAt = performance.now();
  const server = createServer((request, response) => {
    void (async () => {
      const path = request.url ?? "",
        file = paths.get(path);
      if (request.method !== "GET" || !file) {
        response.writeHead(404).end();
        return;
      }
      counters.requests++;
      if (throttle) await delay(80);
      const extension = file.path.split(".").at(-1);
      const type =
        extension === "wasm"
          ? "application/wasm"
          : ["js", "mjs"].includes(extension ?? "")
            ? "text/javascript"
            : extension === "html"
              ? "text/html"
              : extension === "json"
                ? "application/json"
                : "application/octet-stream";
      response.writeHead(200, {
        "Content-Type": type,
        "Content-Length": file.bytes,
        "Cache-Control": "public, max-age=3600",
      });
      const source = createReadStream(file.path, { highWaterMark: 65536 });
      const cancelled = new AbortController();
      response.on("close", () => {
        source.destroy();
        cancelled.abort();
      });
      try {
        for await (const chunk of source) {
          if (throttle) {
            const now = performance.now(),
              scheduled = Math.max(now, nextAt);
            nextAt = scheduled + chunk.length / (10_000_000 / 8 / 1000);
            if (scheduled > now) await delay(scheduled - now);
          }
          if (response.destroyed) break;
          counters.decodedBytesWritten += chunk.length;
          if (!response.write(chunk))
            await once(response, "drain", { signal: cancelled.signal });
        }
        response.end();
      } finally {
        source.destroy();
      }
    })().catch(() => response.destroy());
  });
  server.listen(4198, "127.0.0.1");
  await once(server, "listening");
  return {
    counters,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}
