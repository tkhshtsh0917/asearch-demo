import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import type { EnginePin } from "./pin.ts";

export async function prepareArchive(
  source: string,
  pin: EnginePin,
  root: URL,
): Promise<void> {
  const info = await stat(source);
  if (!info.isFile() || info.size > 16 * 1024 * 1024)
    throw new Error("Engine archive exceeds 16 MiB");
  const bytes = await readFile(source);
  if (
    bytes.length > 16 * 1024 * 1024 ||
    createHash("sha256").update(bytes).digest("hex") !== pin.sha256
  )
    throw new Error("Engine archive does not match the pinned SHA-256");
  const target = new URL(`vendor/${pin.archive}`, root);
  const temporary = new URL(`vendor/.${pin.archive}.${randomUUID()}.tmp`, root);
  await mkdir(new URL("vendor/", root), { recursive: true });
  try {
    // Install exactly the verified snapshot, even if the source changes later.
    await writeFile(temporary, bytes, { flag: "wx" });
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
}
