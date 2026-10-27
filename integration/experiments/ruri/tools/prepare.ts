/** Prepares hash-pinned model files and matching local inference-runtime assets. */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import lock from "../model.lock.json" with { type: "json" };
import runtime from "../runtime.lock.json" with { type: "json" };
import { preparePinned, sha256 } from "./pinned.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(root, "public/models/ruri");
await mkdir(output, { recursive: true });
for (const file of lock.files)
  await preparePinned(
    {
      ...file,
      url: `https://huggingface.co/${file.repo}/resolve/${file.revision}/${file.remotePath}`,
    },
    resolve(output, file.path),
  );

const require = createRequire(import.meta.url);
const runtimeDirectory = dirname(require.resolve("onnxruntime-web/wasm"));
const runtimeOutput = resolve(root, "public/runtime");
await mkdir(runtimeOutput, { recursive: true });
const runtimeFiles = [];
for (const name of await readdir(runtimeDirectory)) {
  if (!/^ort-wasm-simd-threaded\.(wasm|mjs)$/.test(name)) continue;
  const bytes = await readFile(resolve(runtimeDirectory, name));
  const pin = runtime.files.find((file) => file.path === name);
  if (!pin || bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256)
    throw new Error("Installed runtime does not match runtime.lock.json");
  await writeFile(resolve(runtimeOutput, name), bytes);
  runtimeFiles.push({
    path: name,
    bytes: bytes.byteLength,
    sha256: sha256(bytes),
  });
}
if (runtimeFiles.length !== 2)
  throw new Error("Expected matching CPU WASM/MJS runtime files");

await writeFile(
  resolve(root, "public/assets.json"),
  `${JSON.stringify({ model: lock, runtime: { version: "1.31.1", files: runtimeFiles } }, null, 2)}\n`,
);
process.stdout.write("Prepared local model and CPU runtime assets.\n");
