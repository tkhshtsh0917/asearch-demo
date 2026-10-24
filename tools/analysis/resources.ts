/** Prepares verified native resources without mapping mutable cache filenames. */
import { spawnSync } from "node:child_process";
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
import { nativeCLI, runNative } from "./native.ts";
import {
  dictionaryPath,
  resourceDirectory,
  resourceLock,
  resourcePath,
  root,
  sourceURL,
} from "./pins.ts";

async function prepareDictionary(): Promise<void> {
  const dict = resourceLock.dictionary;
  if (
    !/^[a-f0-9]{64}$/.test(dict.sha256) ||
    !Number.isSafeInteger(dict.bytes) ||
    !Number.isSafeInteger(dict.systemBytes) ||
    !/^https:\/\/d2ej7fkh96fzlu\.cloudfront\.net\/sudachidict\/v1\/sudachi-dictionary-\d{8}-core\.zip$/.test(
      dict.url,
    ) ||
    dict.bytes < 1 ||
    dict.bytes > 256 * 1024 * 1024 ||
    dict.systemBytes < 1 ||
    dict.systemBytes > 512 * 1024 * 1024 ||
    !/^sudachi-dictionary-\d{8}\/system_core\.dic$/.test(dict.member)
  )
    throw new Error("Invalid system dictionary pin");
  await cached(
    dictionaryPath(),
    { bytes: dict.systemBytes, sha256: dict.systemSha256 },
    async () => {
      const archive = new URL(`${dict.sha256}.system.zip`, resourceDirectory);
      await cached(archive, dict, () => download(dict.url, dict.bytes));
      const result = spawnSync(
        "unzip",
        ["-p", fileURLToPath(archive), dict.member],
        { maxBuffer: dict.systemBytes + 1, timeout: 60_000 },
      );
      if (result.error || result.status !== 0)
        throw new Error(
          "System dictionary extraction failed; unzip is required",
          { cause: result.error },
        );
      return result.stdout;
    },
  );
}

/** Compiles upstream text once with the same native CLI used for question analysis. */
export async function prepareResources(): Promise<void> {
  await mkdir(resourceDirectory, { recursive: true });
  for (const [name, pin] of Object.entries(resourceLock.files)) {
    const url = sourceURL(name);
    await cached(resourcePath(name), pin, () => download(url, pin.bytes));
  }
  await prepareDictionary();

  const temporary = await mkdtemp(
    fileURLToPath(new URL("convert-", resourceDirectory)),
  );
  try {
    const converted = pathToFileURL(join(temporary, "resources.json"));
    runNative([
      "compile-analysis-resources",
      ...["stopwords.txt", "stoptags.txt", "synonyms.txt"].map((name) =>
        fileURLToPath(resourcePath(name)),
      ),
      fileURLToPath(converted),
    ]);
    const bytes = await readFile(converted),
      compiledSha256 = digest(bytes);
    const name = `${compiledSha256}.resources.json`;
    await cached(
      new URL(name, resourceDirectory),
      { bytes: bytes.length, sha256: compiledSha256 },
      async () => bytes,
    );
    const ready = join(temporary, "ready.json");
    await writeFile(
      ready,
      `${JSON.stringify({ resourceLockSha256: digest(await readFile(new URL("resources.lock.json", import.meta.url))), compiledSha256, compiledFile: name, analyzerCliSha256: digest(await readFile(nativeCLI)) })}\n`,
    );
    await rename(ready, new URL(".analysis/ready.json", root));
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
