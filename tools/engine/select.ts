import { appendFile, writeFile } from "node:fs/promises";
import { resolveRelease } from "./resolve.ts";

const selector = process.argv[2];
if (!selector)
  throw new Error("Usage: node tools/engine/select.ts TAG_OR_latest");
const pin = await resolveRelease(selector);
await writeFile(
  new URL("../../release.lock.json", import.meta.url),
  `${JSON.stringify(pin, null, 2)}\n`,
);
if (process.env.GITHUB_OUTPUT)
  await appendFile(process.env.GITHUB_OUTPUT, `tag=${pin.tag}\n`);
console.log(`Selected ${pin.tag} with checksums for all supported platforms`);
