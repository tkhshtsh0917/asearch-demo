/** Reads intrinsic view metadata before making a bounded copy of a caller-owned array. */
const typed = Object.getPrototypeOf(Uint8Array.prototype);
const intrinsic = (name: string) => {
  const get = Object.getOwnPropertyDescriptor(typed, name)?.get;
  if (!get) throw new Error("Typed-array intrinsics unavailable");
  return get;
};
const getBuffer = intrinsic("buffer"),
  getOffset = intrinsic("byteOffset"),
  getLength = intrinsic("byteLength");
const getTag = Object.getOwnPropertyDescriptor(typed, Symbol.toStringTag)?.get;
const getResizable = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  "resizable",
)?.get;
const getArrayBytes = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  "byteLength",
)?.get;

export function copyView(
  value: unknown,
  tag: "Uint8Array" | "Float32Array" | "Uint32Array",
  maxBytes: number,
  engineBuffer?: ArrayBuffer,
): Uint8Array<ArrayBuffer> {
  if (!ArrayBuffer.isView(value) || getTag?.call(value) !== tag)
    throw new TypeError(`Expected ${tag}`);
  const buffer: unknown = getBuffer.call(value);
  // The intrinsic ArrayBuffer getter rejects SharedArrayBuffer and custom lookalikes.
  getArrayBytes?.call(buffer);
  if (buffer === engineBuffer || getResizable?.call(buffer))
    throw new TypeError("Aliased or resizable input buffer");
  const offset = getOffset.call(value) as number,
    length = getLength.call(value) as number;
  if (length > maxBytes) throw new RangeError("Input byte limit");
  const source = new Uint8Array(buffer as ArrayBuffer, offset, length);
  const copy = new Uint8Array(length);
  Uint8Array.prototype.set.call(copy, source);
  return copy;
}
