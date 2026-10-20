import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { parquetReadObjects } from "hyparquet";
import { questionsFromRows, serializeQuestions } from "./corpus.ts";
import { rangeFile } from "./range-file.ts";

const root = new URL("../../", import.meta.url);
const source = JSON.parse(
  await readFile(new URL("dataset.lock.json", root), "utf8"),
) as {
  dataset: string;
  revision: string;
  file: string;
  fileBytes: number;
  fileSha256: string;
  license: string;
  rowStart: number;
  rows: number;
  outputSha256: string;
};
if (
  !/^[a-f0-9]{40}$/.test(source.revision) ||
  !/^[a-f0-9]{64}$/.test(source.outputSha256) ||
  !Number.isSafeInteger(source.rows) ||
  source.rows < 1 ||
  source.rows > 10_000 ||
  !Number.isSafeInteger(source.rowStart) ||
  source.rowStart < 0 ||
  !Number.isSafeInteger(source.fileBytes) ||
  source.fileBytes <= 0
) {
  throw new Error("Invalid dataset pin or bounded row selection");
}
const sourceUrl = `https://huggingface.co/datasets/${source.dataset}/resolve/${source.revision}/${source.file}`;
const rows = await parquetReadObjects({
  file: rangeFile(sourceUrl, source.fileBytes),
  columns: ["passage_id", "query", "title", "url"],
  rowStart: source.rowStart,
  rowEnd: source.rowStart + source.rows,
});
if (rows.length !== source.rows) throw new Error("Dataset row count changed");
const content = serializeQuestions(questionsFromRows(rows, source.rowStart));
const sha256 = createHash("sha256").update(content).digest("hex");
if (source.outputSha256 !== sha256) {
  throw new Error("Prepared questions do not match the pinned SHA-256");
}
const output = new URL("public/data/", root);
await mkdir(output, { recursive: true });
const temporary = new URL("questions.jsonl.tmp", output);
await writeFile(temporary, content);
await rename(temporary, new URL("questions.jsonl", output));
await writeFile(
  new URL("attribution.json", output),
  `${JSON.stringify(
    {
      dataset: source.dataset,
      revision: source.revision,
      sourceUrl,
      license: source.license,
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
      creator: "CL Research Group in Nagoya, Japan / AutoWikiQA contributors",
      upstream: "https://huggingface.co/datasets/hpprc/jawiki",
      changes:
        "Selected physical rows and extracted query, title, passage_id and url; omitted answer and source passage.",
      rows: rows.length,
      sha256,
    },
    null,
    2,
  )}\n`,
);
console.log(JSON.stringify({ rows: rows.length, sha256 }));
