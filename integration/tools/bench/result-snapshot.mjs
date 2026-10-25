// Compare observable result semantics while excluding owner-specific opaque references.
export function resultSnapshot(result, positional = false) {
  if (positional && result.starts === undefined)
    throw new Error("Positional result is missing starts");
  return JSON.stringify(
    ["ids", "levels", "orders", "totals", "starts"].map((key) =>
      result[key] === undefined ? null : Array.from(result[key]),
    ),
  );
}
