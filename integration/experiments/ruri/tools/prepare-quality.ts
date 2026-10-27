/** Materializes a pinned labeled retrieval dataset outside ordinary offline tests. */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { asyncBufferFromFile, parquetReadObjects } from "hyparquet";
import lock from "../quality.lock.json" with { type: "json" };
import { preparePinned } from "./pinned.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const directory = resolve(root, ".reference/quality");
await mkdir(directory, { recursive: true });
for (const file of lock.files)
  await preparePinned(file, resolve(directory, file.path));
const documents = await parquetReadObjects({
  file: await asyncBufferFromFile(resolve(directory, "corpus.parquet")),
});
const queries = await parquetReadObjects({
  file: await asyncBufferFromFile(resolve(directory, "queries.parquet")),
});
await writeFile(
  resolve(directory, "source.json"),
  `${JSON.stringify({ pin: lock, documents, queries }, (_key, value) => (typeof value === "bigint" ? value.toString() : value))}\n`,
);
process.stdout.write(
  `Pinned quality source: ${documents.length} documents, ${queries.length} queries\n`,
);
