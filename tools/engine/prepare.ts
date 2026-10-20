import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { prepareArchive } from "./archive.ts";
import { enginePin } from "./pin.ts";

const root = new URL("../../", import.meta.url);
const pin = enginePin(
  JSON.parse(await readFile(new URL("engine.lock.json", root), "utf8")),
);
const source =
  process.argv[2] ?? fileURLToPath(new URL(`vendor/${pin.archive}`, root));
await prepareArchive(source, pin, root);
console.log(
  `Verified asearch-wasm ${pin.version} from ${pin.revision.slice(0, 12)}`,
);
