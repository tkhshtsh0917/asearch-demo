/** Resolves upstream heads explicitly and validates conversion before changing pins. */
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { cached, digest, download } from "./cache.ts";
import { runNative } from "./native.ts";
import { resourceDirectory, resourceLock } from "./pins.ts";

const next = structuredClone(resourceLock);
const revisions = new Map<string, string>();
for (const repository of [
  "WorksApplications/SudachiDict",
  "WorksApplications/elasticsearch-sudachi",
]) {
  const commit = JSON.parse(
    (
      await download(
        `https://api.github.com/repos/${repository}/commits/develop`,
        256 * 1024,
      )
    ).toString(),
  ) as { sha?: string };
  if (!commit.sha || !/^[a-f0-9]{40}$/.test(commit.sha))
    throw new Error("Invalid upstream revision");
  revisions.set(repository, commit.sha);
}
next.revision = revisions.get(next.repository) ?? next.revision;
await mkdir(resourceDirectory, { recursive: true });
for (const [name, pin] of Object.entries(next.files)) {
  const repository = pin.repository ?? next.repository;
  const revision = revisions.get(repository);
  if (!revision) throw new Error("Unexpected analysis repository");
  const bytes = await download(
    `https://raw.githubusercontent.com/${repository}/${revision}/${pin.source}`,
    8 * 1024 * 1024,
  );
  pin.bytes = bytes.length;
  pin.sha256 = digest(bytes);
  if (pin.repository) pin.revision = revision;
  await cached(
    new URL(`${pin.sha256}.${name}`, resourceDirectory),
    pin,
    async () => bytes,
  );
}

const temporary = await mkdtemp(
  fileURLToPath(new URL("update-", resourceDirectory)),
);
try {
  const files = ["stopwords.txt", "stoptags.txt", "synonyms.txt"].map(
    (name) => {
      const pin = next.files[name];
      if (!pin) throw new Error("Missing language resource");
      return fileURLToPath(new URL(`${pin.sha256}.${name}`, resourceDirectory));
    },
  );
  runNative([
    "compile-analysis-resources",
    ...files,
    join(temporary, "resources.json"),
  ]);
  // Parse the native output before committing the new source pointers to disk.
  JSON.parse(await readFile(join(temporary, "resources.json"), "utf8"));
  const pending = pathToFileURL(join(temporary, "resources.lock.json"));
  await writeFile(pending, `${JSON.stringify(next, null, 2)}\n`);
  await rename(pending, new URL("resources.lock.json", import.meta.url));
  console.log(
    `Updated language resources: ${[...revisions].map(([repo, sha]) => `${repo}@${sha}`).join(", ")}`,
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
