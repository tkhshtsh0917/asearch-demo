import assert from "node:assert/strict";
import test from "node:test";
import { gzipSync } from "node:zlib";
import { bundleRoot, releaseFiles } from "../tools/archive.ts";

function archive(change?: (headers: Buffer[]) => void) {
  const names = [
    "vectide",
    "vectide_wasm.wasm",
    "THIRD-PARTY-NOTICES.txt",
    "LICENSE-MIT",
    "LICENSE-APACHE",
    "release.json",
    "SHA256SUMS",
  ];
  const headers = names.map((name) => {
    const h = Buffer.alloc(512);
    h.write(`${bundleRoot}/${name}`);
    h.write("00000000001\0", 124);
    h[156] = 48;
    h.write("ustar\0", 257);
    return h;
  });
  change?.(headers);
  for (const h of headers) {
    h.fill(32, 148, 156);
    const sum = h.reduce((a, b) => a + b, 0);
    h.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148);
  }
  return gzipSync(
    Buffer.concat([
      ...headers.flatMap((h) => [
        h,
        Buffer.concat([Buffer.from("x"), Buffer.alloc(511)]),
      ]),
      Buffer.alloc(1024),
    ]),
  );
}
test("fixed release layout accepts complete regular files and rejects paths, links and duplicates", () => {
  assert.equal(releaseFiles(archive()).size, 7);
  for (const change of [
    (h: Buffer[]) => {
      h[0]?.fill(0, 0, 100);
      h[0]?.write("../escape");
    },
    (h: Buffer[]) => {
      if (h[0]) h[0][156] = 50;
    },
    (h: Buffer[]) => {
      if (h[0] && h[1]) h[0].copy(h[1], 0, 0, 100);
    },
  ])
    assert.throws(() => releaseFiles(archive(change)));
  assert.throws(() => releaseFiles(new Uint8Array([0, 1, 2])));
});
