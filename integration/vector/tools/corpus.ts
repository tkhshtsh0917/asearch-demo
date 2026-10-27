/** Materializes a pinned question-only benchmark prefix, without answers or passages. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parquetReadObjects } from "hyparquet";
import {
  questionsFromRows,
  serializeQuestions,
} from "../../../tools/data/corpus.ts";
import { rangeFile } from "../../../tools/data/range-file.ts";
import pin from "../corpus.lock.json" with { type: "json" };

assert.match(pin.revision, /^[a-f0-9]{40}$/);
assert.match(pin.outputSha256, /^[a-f0-9]{64}$/);
assert.equal(pin.rows, 50000);
const directory = new URL("../.data/", import.meta.url);
const output = new URL("wiki50k-questions.jsonl", directory);
const hash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
try {
  const existing = await readFile(output);
  assert.equal(hash(existing), pin.outputSha256);
  process.stdout.write("Pinned question corpus already prepared.\n");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  const rows = await parquetReadObjects({
    file: rangeFile(
      `https://huggingface.co/datasets/${pin.dataset}/resolve/${pin.revision}/${pin.file}`,
      pin.fileBytes,
    ),
    columns: ["passage_id", "query", "title", "url"],
    rowStart: pin.rowStart,
    rowEnd: pin.rowStart + pin.rows,
  });
  assert.equal(rows.length, pin.rows);
  const bytes = new TextEncoder().encode(
    serializeQuestions(questionsFromRows(rows, pin.rowStart)),
  );
  assert.equal(hash(bytes), pin.outputSha256, "Immutable subset digest");
  await mkdir(directory, { recursive: true });
  await writeFile(output, bytes, { flag: "wx" });
}
