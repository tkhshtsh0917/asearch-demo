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
import { cached, digest, download, verifyBytes } from "./cache.ts";
import {
  type NativeRunner,
  nativeCLI,
  runNative,
  writeNative,
} from "./native.ts";
import {
  dictionaryPath,
  type ResourceLock,
  type ResourcePaths,
  resourcePath,
  resourcePaths,
  sourceURL,
} from "./pins.ts";

async function prepareDictionary(
  resourceLock: ResourceLock,
  directory: URL,
): Promise<void> {
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
    dictionaryPath(resourceLock, directory),
    { bytes: dict.systemBytes, sha256: dict.systemSha256 },
    async () => {
      const archive = new URL(`${dict.sha256}.system.zip`, directory);
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
export async function prepareResources(
  paths: ResourcePaths = resourcePaths,
  binary = nativeCLI,
  execute: NativeRunner = runNative,
): Promise<void> {
  const lockBytes = await readFile(paths.lock);
  const resourceLock: ResourceLock = JSON.parse(lockBytes.toString());
  const cliBytes = await readFile(binary);
  const resourceLockSha256 = digest(lockBytes),
    analyzerCliSha256 = digest(cliBytes);

  await mkdir(paths.directory, { recursive: true });
  for (const [name, pin] of Object.entries(resourceLock.files)) {
    const url = sourceURL(name, resourceLock);
    await cached(resourcePath(name, resourceLock, paths.directory), pin, () =>
      download(url, pin.bytes),
    );
  }
  await prepareDictionary(resourceLock, paths.directory);

  const temporary = await mkdtemp(
    fileURLToPath(new URL("convert-", paths.directory)),
  );
  try {
    const sources: string[] = [];
    for (const name of ["stopwords.txt", "stoptags.txt", "synonyms.txt"]) {
      const pin = resourceLock.files[name];
      if (!pin) throw new Error("Missing language resource");
      const bytes = await readFile(
        resourcePath(name, resourceLock, paths.directory),
      );
      verifyBytes(bytes, pin);
      const file = join(temporary, name);
      await writeFile(file, bytes);
      sources.push(file);
    }

    const converted = pathToFileURL(join(temporary, "resources.json"));
    execute(
      ["compile-analysis-resources", ...sources, fileURLToPath(converted)],
      writeNative(temporary, cliBytes),
    );
    const bytes = await readFile(converted),
      compiledSha256 = digest(bytes);
    const name = `${compiledSha256}.resources.json`;
    await cached(
      new URL(name, paths.directory),
      { bytes: bytes.length, sha256: compiledSha256 },
      async () => bytes,
    );
    const ready = join(temporary, "ready.json");
    if (
      digest(await readFile(paths.lock)) !== resourceLockSha256 ||
      digest(await readFile(binary)) !== analyzerCliSha256
    )
      throw new Error(
        "Analysis inputs changed during preparation; run analysis:prepare again",
      );
    await writeFile(
      ready,
      `${JSON.stringify({ resourceLockSha256, compiledSha256, compiledFile: name, analyzerCliSha256 })}\n`,
    );
    await rename(ready, paths.ready);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
