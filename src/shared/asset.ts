/** Validates one local immutable-asset filename, excluding paths and URLs. */
export function assetName(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[a-zA-Z0-9._-]+$/.test(value) ||
    value === "." ||
    value === ".."
  )
    throw new Error("Invalid asset filename");
  return value;
}
