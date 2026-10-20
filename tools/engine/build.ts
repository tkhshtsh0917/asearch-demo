import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareArchive } from "./archive.ts";
import { enginePin } from "./pin.ts";

const root = new URL("../../", import.meta.url);
const pin = enginePin(
  JSON.parse(await readFile(new URL("engine.lock.json", root), "utf8")),
);
const temporary = await mkdtemp(join(tmpdir(), "asearch-demo-engine-"));
function run(command: string, args: string[], cwd: string): void {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${command} failed while preparing the pinned engine`);
}
try {
  const source = join(temporary, "source");
  run(
    "git",
    ["clone", "--no-checkout", "--filter=blob:none", pin.repository, source],
    temporary,
  );
  run("git", ["checkout", "--detach", pin.revision], source);
  run("pnpm", ["install", "--frozen-lockfile"], source);
  run("pnpm", ["build"], source);
  run(
    "npm",
    [
      "pack",
      "--workspace",
      "packages/asearch-wasm",
      "--ignore-scripts",
      "--cache",
      join(temporary, "npm-cache"),
      "--pack-destination",
      temporary,
    ],
    source,
  );
  await prepareArchive(join(temporary, pin.archive), pin, root);
  console.log(`Built and verified ${pin.package} from pinned source`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
