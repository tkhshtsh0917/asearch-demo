import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { startServer } from "./start-server.mjs";

test("parallel benchmark servers identify their own listening endpoints", async () => {
  const unrelated = createServer((_, res) => res.end("unrelated"));
  await new Promise((resolve) => unrelated.listen(0, "127.0.0.1", resolve));
  const servers = [];
  try {
    servers.push(await startServer(), await startServer());
    assert.notEqual(servers[0].url, servers[1].url);
    for (const server of servers) {
      assert.notEqual(
        new URL(server.url).port,
        String(unrelated.address().port),
      );
      assert.match(await (await fetch(server.url)).text(), /Asearch benchmark/);
    }
  } finally {
    for (const server of servers) await server.close();
    await new Promise((resolve) => unrelated.close(resolve));
  }
});

test("benchmark transport accepts the default 10000-document fixture", async () => {
  const server = await startServer();
  try {
    const units = Array.from({ length: 1200000 }, () => 97);
    const input = {
      units,
      lengths: Array(20000).fill(60),
      keys: Array.from({ length: 20000 }, (_, i) => Math.floor(i / 2)),
      orders: Array.from({ length: 20000 }, (_, i) => Math.floor(i / 2)),
      tombstones: [],
      config: [
        2, 1, 1, 31, 512, 268435456, 1000000, 10000000, 16777216, 536870912,
        65535, 8,
      ],
    };
    const response = await fetch(new URL("/__fixture", server.url), {
      method: "POST",
      body: JSON.stringify({ command: "build-flat", input }),
    });
    assert.equal(response.status, 200);
    assert.equal(
      Buffer.from(await response.arrayBuffer())
        .subarray(0, 4)
        .toString(),
      "ASIX",
    );
  } finally {
    await server.close();
  }
});
