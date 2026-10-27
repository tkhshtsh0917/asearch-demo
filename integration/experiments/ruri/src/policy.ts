/** Applies retrieval roles and validates the bounded probe's text and vector math. */
import lock from "../model.lock.json" with { type: "json" };

export type Role = "query" | "document";

export function prefixText(text: string, role: Role): string {
  if (typeof text !== "string" || text.trim().length === 0)
    throw new Error("Empty input");
  if (new TextEncoder().encode(text).byteLength > lock.limits.textBytes)
    throw new Error("Text byte limit");
  if (role !== "query" && role !== "document") throw new Error("Invalid role");
  return `${role === "query" ? lock.queryPrefix : lock.documentPrefix}${text}`;
}

export function normalize(vector: Float32Array): Float32Array {
  let squared = 0;
  for (const value of vector) {
    if (!Number.isFinite(value)) throw new Error("Nonfinite vector");
    squared += value * value;
  }
  if (!(squared > 0)) throw new Error("Zero-norm vector");

  const norm = Math.sqrt(squared);
  return Float32Array.from(vector, (value) => value / norm);
}

/** Pools token embeddings with the attention mask, retaining prefix/special tokens. */
export function meanPool(
  hidden: Float32Array,
  mask: readonly number[],
  dimensions: number,
): Float32Array {
  if (
    !Number.isInteger(dimensions) ||
    dimensions < 1 ||
    dimensions > 4096 ||
    hidden.length !== mask.length * dimensions
  ) {
    throw new Error("Invalid output shape");
  }
  const sums = new Float64Array(dimensions);
  let count = 0;
  for (let token = 0; token < mask.length; token++) {
    const weight = mask[token];
    if (weight !== 0 && weight !== 1) throw new Error("Invalid attention mask");
    if (weight === 0) continue;
    count++;
    for (let d = 0; d < dimensions; d++) {
      const value = hidden[token * dimensions + d];
      if (value === undefined || !Number.isFinite(value))
        throw new Error("Nonfinite token output");
      sums[d] = (sums[d] ?? 0) + value;
    }
  }
  if (count === 0) throw new Error("Empty attention mask");
  return normalize(Float32Array.from(sums, (value) => value / count));
}
