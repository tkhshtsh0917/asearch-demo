export async function request(command, input) {
  const response = await fetch("/__fixture", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command, input }),
  });
  if (!response.ok) throw new Error(await response.text());
  return new Uint8Array(await response.arrayBuffer());
}

export function buildFlat(units, lengths, keys, orders, tombstones, config) {
  return request(
    "build-flat",
    Object.fromEntries(
      Object.entries({ units, lengths, keys, orders, tombstones, config }).map(
        ([k, v]) => [k, Array.from(v)],
      ),
    ),
  );
}
