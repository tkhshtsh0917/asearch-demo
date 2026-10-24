/** Supplies isolated, offline resource generations and a deterministic native-process stand-in. */
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestContext } from "node:test";
import { pathToFileURL } from "node:url";
import { digest } from "../cache.ts";
import type { NativeRunner } from "../native.ts";
import { dictionaryPath, type ResourceLock, resourcePath } from "../pins.ts";
import { prepareResources } from "../resources.ts";
import { type AnalysisPaths, createAnalysis } from "../run.ts";

export function fixture(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), "asearch-generation-test-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const base = pathToFileURL(`${directory}/`);
  const paths: AnalysisPaths = {
    lock: new URL("resources.lock.json", base),
    ready: new URL("ready.json", base),
    directory: new URL("resources/", base),
    policy: new URL("policy.json", base),
    cli: join(directory, process.platform === "win32" ? "cli.cmd" : "cli"),
  };
  mkdirSync(paths.directory);
  const lock: ResourceLock = {
    repository: "WorksApplications/SudachiDict",
    revision: "a".repeat(40),
    files: {},
    dictionary: {
      version: "20261015",
      url: "https://d2ej7fkh96fzlu.cloudfront.net/sudachidict/v1/sudachi-dictionary-20261015-core.zip",
      member: "sudachi-dictionary-20261015/system_core.dic",
      bytes: 1,
      sha256: digest("z"),
      systemBytes: 1,
      systemSha256: digest("D"),
    },
  };

  const saveLock = () => writeFileSync(paths.lock, `${JSON.stringify(lock)}\n`);
  const source = (name: string, text: string) => {
    const bytes = Buffer.from(text);
    lock.files[name] = {
      source: name,
      bytes: bytes.length,
      sha256: digest(bytes),
    };
    writeFileSync(resourcePath(name, lock, paths.directory), bytes);
    saveLock();
  };
  const policy = (limit: number) =>
    writeFileSync(
      paths.policy,
      JSON.stringify({
        splitMode: "C",
        keepPartOfSpeech: ["名詞"],
        maxSynonymTexts: limit,
        maxDocumentUnits: 131072,
      }),
    );
  const cli = (version: string) => writeFileSync(paths.cli, version);
  const hooks: { compile?: () => void } = {};
  const run: NativeRunner = (args, binary) => {
    const version = readFileSync(binary, "utf8");
    const [command, ...files] = args;
    const file = (index: number) => {
      const path = files[index];
      if (!path) throw new Error("Missing native fixture argument");
      return path;
    };
    if (command === "compile-analysis-resources") {
      const stopwords = [readFileSync(file(0), "utf8").trim()];
      hooks.compile?.();
      writeFileSync(
        file(3),
        JSON.stringify({
          format: "asearch-analysis-resources/1",
          stopwords,
          stoptags: [],
          groups: {},
        }),
      );
    } else if (command === "analyze") {
      const alias = [
        JSON.parse(readFileSync(file(1), "utf8")).stopwords[0],
        JSON.parse(readFileSync(file(2), "utf8")).maxSynonymTexts,
        version,
        readFileSync(file(0), "utf8"),
      ].join("/");
      const rows = readFileSync(file(3), "utf8")
        .trim()
        .split("\n")
        .map((line) => {
          const doc = JSON.parse(line);
          return { ...doc, order: doc.key, texts: [...doc.texts, alias] };
        });
      writeFileSync(
        file(4),
        `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`,
      );
    } else if (command === "query-rules") {
      writeFileSync(
        file(4),
        JSON.stringify({
          format: "asearch-query-rules/1",
          forms: [
            [
              "変化",
              `${version}/${JSON.parse(readFileSync(file(2), "utf8")).maxSynonymTexts}`,
            ],
          ],
          kana: [
            ["び", "bi"],
            ["ー", "-"],
          ],
        }),
      );
    } else throw new Error("Unexpected native fixture command");
  };

  source("stopwords.txt", "old");
  source("stoptags.txt", "助詞");
  source("synonyms.txt", "000001,,,,,,,,京都,,\n");
  writeFileSync(dictionaryPath(lock, paths.directory), "D");
  policy(1);
  cli("A");

  return {
    paths,
    lock,
    source,
    policy,
    cli,
    saveLock,
    hooks,
    run,
    async prepare() {
      await prepareResources(paths, paths.cli, run);
      return createAnalysis(paths, run);
    },
  };
}
