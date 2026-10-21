import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../../", import.meta.url);
const release = JSON.parse(
  await readFile(new URL("release.lock.json", root), "utf8"),
);
await writeFile(
  new URL("dist/release.json", root),
  `${JSON.stringify(
    {
      release,
      demoCommit: process.env.GITHUB_SHA ?? null,
      runId: process.env.GITHUB_RUN_ID ?? null,
    },
    null,
    2,
  )}\n`,
);
