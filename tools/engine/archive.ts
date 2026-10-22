/** Checks archive paths and file kinds before extracting Release executables. */
import { spawnSync } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";

/** Returns a validated extraction directory; the caller owns its cleanup. */
export async function unpackRelease(archive: string, temporary: string) {
  const list = spawnSync("tar", ["-tzf", archive], { encoding: "utf8" });
  if (
    list.status !== 0 ||
    list.stdout
      .split("\n")
      .some(
        (name) =>
          name.startsWith("/") ||
          name.includes("\\") ||
          name.split("/").includes(".."),
      )
  )
    throw new Error("Invalid release archive paths");

  const kinds = spawnSync("tar", ["-tvzf", archive], { encoding: "utf8" });
  if (
    kinds.status !== 0 ||
    kinds.stdout
      .split("\n")
      .filter(Boolean)
      .some((line) => !["-", "d"].includes(line[0] ?? ""))
  )
    throw new Error(
      "Release archive must contain regular files and directories only",
    );

  const unpack = join(temporary, "unpack");
  await mkdir(unpack);
  const result = spawnSync("tar", ["-xzf", archive, "-C", unpack]);
  if (result.status !== 0) throw new Error("Cannot unpack release asset");

  const cli = process.platform === "win32" ? "asearch-cli.exe" : "asearch-cli";
  for (const name of [
    cli,
    "asearch_wasm.wasm",
    "NOTICE",
    "LICENSE-MIT",
    "LICENSE-APACHE",
  ])
    await readFile(join(unpack, name));

  return { unpack, cli };
}
