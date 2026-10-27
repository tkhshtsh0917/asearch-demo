/** Runs the pinned Ruri ONNX encoder on a single CPU thread. */
import * as ort from "onnxruntime-web/wasm";
import lock from "../model.lock.json";
import runtime from "../runtime.lock.json";
import { assetStats, verifiedAsset } from "./assets.ts";
import { cacheStats } from "./cache.ts";
import { meanPool, prefixText, type Role } from "./policy.ts";
import { loadTokenizer } from "./tokenizer.ts";

export async function loadEncoder(
  base = new URL("/", globalThis.location.href).href,
) {
  const root = new URL(base);
  if (
    root.origin !== globalThis.location.origin ||
    root.search ||
    root.hash ||
    !root.pathname.endsWith("/")
  )
    throw new Error("Invalid encoder asset base");
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.wasmPaths = new URL("runtime/", root).href;

  const start = performance.now();
  const buffers = await Promise.all([
    ...lock.files.map((file) =>
      verifiedAsset(
        file.path,
        file.bytes,
        file.sha256,
        new URL("models/ruri/", root).href,
      ),
    ),
    ...runtime.files
      .filter((file) => file.path.endsWith(".wasm"))
      .map((file) =>
        verifiedAsset(
          file.path,
          file.bytes,
          file.sha256,
          new URL("runtime/", root).href,
        ),
      ),
  ]);
  const runtimeBytes = buffers[lock.files.length];
  if (!runtimeBytes) throw new Error("Missing pinned runtime");
  ort.env.wasm.wasmBinary = runtimeBytes;
  const assetsReadyMs = performance.now() - start;
  const json = (path: string) => {
    const index = lock.files.findIndex((file) => file.path === path);
    const buffer = buffers[index];
    if (!buffer) throw new Error(`Missing pinned asset: ${path}`);
    return JSON.parse(new TextDecoder().decode(buffer));
  };
  const tokenizerBytes =
    buffers[lock.files.findIndex((file) => file.path === "tokenizer.json")];
  if (!tokenizerBytes) throw new Error("Missing tokenizer");
  const tokenizer = await loadTokenizer(tokenizerBytes, json("config.json"));
  const model = buffers[0];
  if (!model) throw new Error("Missing model");
  let session: ort.InferenceSession;
  try {
    session = await ort.InferenceSession.create(model, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    });
  } catch (error) {
    tokenizer.dispose();
    delete ort.env.wasm.wasmBinary;
    throw error;
  }
  if (
    session.inputNames.some(
      (name) => name !== "input_ids" && name !== "attention_mask",
    )
  ) {
    await session.release();
    tokenizer.dispose();
    delete ort.env.wasm.wasmBinary;
    throw new Error(`Unexpected model inputs: ${session.inputNames.join(",")}`);
  }
  const readyMs = performance.now() - start;

  let closed = false;
  return {
    async dispose() {
      if (closed) return;
      closed = true;
      try {
        await session.release();
      } finally {
        tokenizer.dispose();
        delete ort.env.wasm.wasmBinary;
      }
    },
    initialization: {
      assetsReadyMs,
      readyMs,
      dimensions: lock.dimensions,
      ...assetStats,
      cache: { ...cacheStats },
    },
    async encode(text: string, role: Role) {
      if (closed) throw new Error("Encoder disposed");
      const began = performance.now();
      const encoded = tokenizer.encode(prefixText(text, role));
      if (encoded.ids.length > lock.limits.tokens)
        throw new Error("Token limit; input was not truncated");
      const mask = encoded.attention_mask;
      const feeds: Record<string, ort.Tensor> = {
        input_ids: new ort.Tensor(
          "int64",
          BigInt64Array.from(encoded.ids, BigInt),
          [1, encoded.ids.length],
        ),
        attention_mask: new ort.Tensor(
          "int64",
          BigInt64Array.from(mask, BigInt),
          [1, encoded.ids.length],
        ),
      };
      const tokenizationMs = performance.now() - began;
      let outputs: ort.InferenceSession.OnnxValueMapType = {};
      try {
        outputs = await session.run(feeds);
        const output = outputs.last_hidden_state;
        if (
          !output ||
          !(output.data instanceof Float32Array) ||
          output.dims.length !== 3 ||
          output.dims[0] !== 1 ||
          output.dims[1] !== mask.length ||
          output.dims[2] !== lock.dimensions
        ) {
          throw new Error("Unexpected model output shape/type");
        }
        const vector = meanPool(output.data, mask, lock.dimensions);
        return {
          vector,
          tokens: encoded.ids,
          tokenCount: mask.length,
          tokenizationMs,
          encodeMs: performance.now() - began,
        };
      } finally {
        for (const tensor of Object.values(outputs)) tensor.dispose();
        for (const tensor of Object.values(feeds)) tensor.dispose();
      }
    },
  };
}
