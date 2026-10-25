/** Creates or verifies the exact file manifest for a Pages Artifact round trip. */
import { readFile, writeFile } from "node:fs/promises";
import { siteHashes, verifySite } from "../site/artifact.ts";

const [mode, directory, manifest] = process.argv.slice(2);
if (!directory || !manifest || !["create", "verify"].includes(mode ?? ""))
  throw new Error(
    "Usage: pages-artifact.ts create|verify <directory> <manifest>",
  );
if (mode === "create") {
  await writeFile(
    manifest,
    `${JSON.stringify(await siteHashes(directory), null, 2)}\n`,
  );
} else {
  await verifySite(directory, JSON.parse(await readFile(manifest, "utf8")));
}
