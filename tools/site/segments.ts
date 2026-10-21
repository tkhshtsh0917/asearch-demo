import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Doc } from "asearch-wasm";

/** Builds publication snapshots with the verified native Release CLI. */
export async function buildSegments(
  base: Doc[],
  changed: Doc[],
  removed: number[],
  effective: Doc[],
) {
  const directory = await mkdtemp(join(tmpdir(), "asearch-publish-"));
  const binary = fileURLToPath(
    new URL(
      `../../integration/.engine/release/asearch-cli${process.platform === "win32" ? ".exe" : ""}`,
      import.meta.url,
    ),
  );
  const file = (name: string) => join(directory, name);
  const run = (args: string[]) => {
    const result = spawnSync(binary, args, {
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    });
    if (result.error) throw result.error;
    if (result.status !== 0)
      throw new Error(`Index CLI failed: ${result.stderr}`);
  };
  const jsonl = (rows: unknown[]) =>
    `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
  try {
    await writeFile(file("base.jsonl"), jsonl(base));
    await writeFile(
      file("delta.jsonl"),
      jsonl([
        ...changed.map((doc) => ({ op: "upsert", ...doc })),
        ...removed
          .filter((key) => !changed.some((doc) => doc.key === key))
          .map((key) => ({ op: "remove", key })),
      ]),
    );
    await writeFile(file("effective.jsonl"), jsonl(effective));
    run(["build", file("base.jsonl"), file("base.asix")]);
    run(["delta", file("delta.jsonl"), file("delta.asix")]);
    run([
      "compact",
      file("compact.asix"),
      file("base.asix"),
      file("delta.asix"),
    ]);
    run(["build", file("effective.jsonl"), file("effective.asix")]);
    const [baseBytes, delta, compact, expected] = await Promise.all([
      readFile(file("base.asix")),
      readFile(file("delta.asix")),
      readFile(file("compact.asix")),
      readFile(file("effective.asix")),
    ]);
    if (!compact.equals(expected))
      throw new Error("CLI compaction differs from effective documents");
    return { base: baseBytes, delta, compact };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
