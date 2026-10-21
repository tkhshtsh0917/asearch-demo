import { prepareRelease } from "./release.ts";

await prepareRelease(new URL("../../", import.meta.url), process.argv[2]);
