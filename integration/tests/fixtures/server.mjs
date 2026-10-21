import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
export const sources = new Map();
export function invoke(command, input) {
  const temporary = mkdtempSync(join(tmpdir(), "asearch-fixture-"));
  const cli = fileURLToPath(
    new URL(
      `../../.engine/release/asearch-cli${process.platform === "win32" ? ".exe" : ""}`,
      import.meta.url,
    ),
  );
  try {
    const output = join(temporary, "out.asix");
    let args;
    if (command === "build-flat") {
      const path = join(temporary, "input.json");
      writeFileSync(path, JSON.stringify(input));
      args = [command, path, output];
    } else {
      args = [
        "compact",
        output,
        ...input.map((id, i) => {
          const path = join(temporary, `${i}.asix`);
          const bytes = sources.get(id);
          if (!bytes) throw new Error("Unknown fixture segment");
          writeFileSync(path, bytes);
          return path;
        }),
      ];
    }
    const result = spawnSync(cli, args, {
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    });
    if (result.error) throw result.error;
    if (result.status !== 0)
      throw Object.assign(new Error(result.stderr), {
        code: /budget|limit|capacity|overflow/i.test(result.stderr)
          ? "RESOURCE_LIMIT"
          : "INVALID_INPUT",
      });
    const bytes = new Uint8Array(readFileSync(output));
    const id = new DataView(bytes.buffer)
      .getBigUint64(24, true)
      .toString(16)
      .padStart(16, "0");
    sources.set(id, bytes);
    return bytes;
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
export function buildFlat(units, lengths, keys, orders, tombstones, config) {
  return invoke(
    "build-flat",
    Object.fromEntries(
      Object.entries({ units, lengths, keys, orders, tombstones, config }).map(
        ([k, v]) => [k, Array.from(v)],
      ),
    ),
  );
}
