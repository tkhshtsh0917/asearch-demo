// Emit a deterministic JSONL server corpus and a separate query workload.
import { writeFile } from "node:fs/promises";
import { querySequences } from "./query-sequences.mjs";
import { workload } from "./workload.mjs";

const [units, seed, documentsPath, queriesPath] = process.argv.slice(2);
if (
  !queriesPath ||
  !/^(0|[1-9]\d*)$/.test(seed ?? "") ||
  Number(seed) > 0xffffffff
)
  throw new Error(
    "Usage: corpus.mjs UNITS UINT32_SEED DOCS_JSONL WORKLOAD_JSON",
  );
const data = workload(Number(units), Number(seed));
await writeFile(
  documentsPath,
  `${data.texts
    .map((text, key) => JSON.stringify({ key, order: key, texts: [text] }))
    .join("\n")}\n`,
  { flag: "wx" },
);
await writeFile(
  queriesPath,
  `${JSON.stringify(
    {
      kind: "session",
      inputs: querySequences(data.texts, Number(seed)),
      runs: 5,
      rounds: 25,
      warmup: 10,
    },
    null,
    2,
  )}\n`,
  { flag: "wx" },
);
console.log(
  JSON.stringify({
    units: data.units,
    seed: data.seed,
    documents: data.texts.length,
  }),
);
