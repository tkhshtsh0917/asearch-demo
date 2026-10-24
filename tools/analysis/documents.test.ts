import assert from "node:assert/strict";
import test from "node:test";
import { digest, verifyBytes } from "./cache.ts";
import { documents } from "./documents.ts";

test("native output preserves original key/order/text before accepting aliases", () => {
  const rows = [{ key: 12, text: "ビートルズの曲は？", title: "", url: "" }];
  const analyses = [
    {
      key: 12,
      order: 12,
      texts: [rows[0]?.text, "biitoruzu", "bi-toruzu", "Beatles"],
    },
  ];
  assert.deepEqual(documents(rows, analyses), analyses);
  for (const invalid of [
    [],
    [{ ...analyses[0], key: 11 }],
    [{ ...analyses[0], texts: ["changed"] }],
    [{ ...analyses[0], texts: [rows[0]?.text, 1] }],
    [{ ...analyses[0], texts: [rows[0]?.text, "a".repeat(65536)] }],
  ])
    assert.throws(() => documents(rows, invalid));
});

test("resource pins reject changed bytes and sizes", () => {
  const bytes = new TextEncoder().encode("fixture");
  const pin = { bytes: bytes.length, sha256: digest(bytes) };
  verifyBytes(bytes, pin);
  assert.throws(() => verifyBytes(new Uint8Array(), pin), /digest mismatch/);
  assert.throws(
    () => verifyBytes(bytes, { ...pin, sha256: "0".repeat(64) }),
    /digest mismatch/,
  );
});
