import assert from "node:assert/strict";
import test from "node:test";
import { copyView } from "../src/bytes.ts";

test("intrinsic metadata ignores subclass getters and methods", () => {
  class Custom extends Uint8Array {
    override get byteLength(): number {
      throw new Error("custom length");
    }
    override get buffer(): ArrayBuffer {
      throw new Error("custom buffer");
    }
    override subarray(): never {
      throw new Error("custom subarray");
    }
  }
  assert.deepEqual(
    Array.from(copyView(new Custom([1, 2, 3]), "Uint8Array", 3)),
    [1, 2, 3],
  );
  assert.throws(
    () => copyView(new Custom([1, 2, 3]), "Uint8Array", 2),
    /byte limit/,
  );
});
test("detached, resizable, shared and wrong-type inputs fail safely", () => {
  const bytes = new Uint8Array([1]);
  structuredClone(bytes, { transfer: [bytes.buffer] });
  assert.throws(() => copyView(bytes, "Uint8Array", 10));
  assert.throws(() =>
    copyView(
      new Uint8Array(new ArrayBuffer(8, { maxByteLength: 16 })),
      "Uint8Array",
      10,
    ),
  );
  assert.throws(() =>
    copyView(new Uint8Array(new SharedArrayBuffer(8)), "Uint8Array", 10),
  );
  assert.throws(() => copyView(new Float32Array(1), "Uint8Array", 10));
});
