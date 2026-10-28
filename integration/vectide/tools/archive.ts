/** Decodes only the fixed regular-file layout of a bounded Linux release bundle. */
import { gunzipSync } from "node:zlib";

const ROOT = "vectide-x86_64-unknown-linux-gnu";
const LIMITS: Record<string, number> = {
  vectide: 64 * 1024 ** 2,
  "vectide_wasm.wasm": 16 * 1024 ** 2,
  "THIRD-PARTY-NOTICES.txt": 16 * 1024 ** 2,
  "LICENSE-MIT": 131072,
  "LICENSE-APACHE": 131072,
  "release.json": 65536,
  SHA256SUMS: 16384,
};
export const bundleRoot = ROOT;
function octal(bytes: Uint8Array) {
  const value = new TextDecoder().decode(bytes).replace(/\0/g, "").trim();
  if (!/^[0-7]+$/.test(value)) throw new Error("Unsupported tar numeric field");
  const n = Number.parseInt(value, 8);
  if (!Number.isSafeInteger(n)) throw new Error("Tar integer range");
  return n;
}
function name(bytes: Uint8Array) {
  const end = bytes.indexOf(0);
  const used = end < 0 ? bytes : bytes.subarray(0, end);
  if (used.some((b) => b < 32 || b > 126))
    throw new Error("Invalid archive filename encoding");
  return new TextDecoder().decode(used);
}
export function releaseFiles(compressed: Uint8Array): Map<string, Uint8Array> {
  if (compressed.byteLength > 128 * 1024 ** 2)
    throw new Error("Release transfer limit");
  const bytes = gunzipSync(compressed, { maxOutputLength: 128 * 1024 ** 2 });
  if (bytes.length % 512 !== 0) throw new Error("Tar block size");
  const files = new Map<string, Uint8Array>();
  let offset = 0,
    ended = false,
    entries = 0;
  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) {
      if (
        bytes.length - offset < 1024 ||
        !bytes.subarray(offset).every((b) => b === 0)
      )
        throw new Error("Tar trailing data");
      ended = true;
      break;
    }
    if (++entries > 8) throw new Error("Archive entry count");
    let sum = 0;
    for (let i = 0; i < 512; i++)
      sum += i >= 148 && i < 156 ? 32 : (header[i] ?? 0);
    if (sum !== octal(header.subarray(148, 156)))
      throw new Error("Tar checksum");
    if (
      !name(header.subarray(257, 263)).startsWith("ustar") ||
      name(header.subarray(345, 500))
    )
      throw new Error("Unsupported tar format");
    const path = name(header.subarray(0, 100)),
      size = octal(header.subarray(124, 136)),
      type = header[156];
    offset += 512;
    if (type === 53 && path === `${ROOT}/` && size === 0) continue;
    const file = path.startsWith(`${ROOT}/`) ? path.slice(ROOT.length + 1) : "";
    const limit = LIMITS[file];
    if (
      !limit ||
      files.has(file) ||
      !(type === 0 || type === 48) ||
      size <= 0 ||
      size > limit ||
      offset + size > bytes.length
    )
      throw new Error("Unexpected release archive entry");
    files.set(file, bytes.subarray(offset, offset + size));
    const padded = Math.ceil(size / 512) * 512;
    if (!bytes.subarray(offset + size, offset + padded).every((b) => b === 0))
      throw new Error("Tar file padding");
    offset += padded;
  }
  if (!ended || files.size !== Object.keys(LIMITS).length)
    throw new Error("Incomplete release archive");
  return files;
}
