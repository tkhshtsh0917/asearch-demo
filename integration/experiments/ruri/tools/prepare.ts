/** Prepares hash-pinned model files and matching local inference-runtime assets. */
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import lock from "../model.lock.json" with { type: "json" };

const root = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(root, "public/models/ruri");
const sha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

async function prepareFile(file: (typeof lock.files)[number]): Promise<void> {
  const path = resolve(output, file.path);
  const cached = await readFile(path).catch(() => undefined);

  if (cached?.byteLength === file.bytes && sha256(cached) === file.sha256)
    return;

  const url = `https://huggingface.co/${file.repo}/resolve/${file.revision}/${file.remotePath}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok || !response.body)
    throw new Error(`Model fetch failed: ${file.path}`);

  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of response.body) {
    total += chunk.byteLength;
    if (total > file.bytes)
      throw new Error(`Model size exceeded: ${file.path}`);
    chunks.push(chunk);
  }

  const bytes = Buffer.concat(chunks);
  if (total !== file.bytes || sha256(bytes) !== file.sha256) {
    throw new Error(`Model integrity mismatch: ${file.path}`);
  }

  await writeFile(`${path}.partial`, bytes);
  await rename(`${path}.partial`, path);
  process.stdout.write(`Prepared ${file.path}: ${total} bytes\n`);
}

await mkdir(output, { recursive: true });
for (const file of lock.files) await prepareFile(file);

const require = createRequire(import.meta.url);
const runtimeDirectory = dirname(require.resolve("onnxruntime-web/wasm"));
const runtimeOutput = resolve(root, "public/runtime");
await mkdir(runtimeOutput, { recursive: true });
const runtimeFiles = [];
for (const name of await readdir(runtimeDirectory)) {
  if (!/^ort-wasm-simd-threaded\.(wasm|mjs)$/.test(name)) continue;
  const bytes = await readFile(resolve(runtimeDirectory, name));
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
