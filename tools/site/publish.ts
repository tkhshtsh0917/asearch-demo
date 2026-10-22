/** Builds a deterministic base/delta/compacted publication and matching catalogs. */
import { createHash } from "node:crypto";
import type { Doc, Manifest } from "asearch-wasm";
import {
  catalog,
  type Question,
  type Release,
} from "../../src/shared/catalog.ts";
import { buildSegments } from "./segments.ts";

export const digest = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");

export async function publish(
  input: Question[],
  attribution: Release["attribution"],
): Promise<Map<string, Uint8Array>> {
  const questions = catalog(input);
  if (questions.length < 4)
    throw new Error("At least four questions are required");
  const first = questions.slice(0, 4),
    key = Math.max(...questions.map((q) => q.key)) + 1;
  if (key > 0xffffffff) throw new Error("No synthetic key available");
  const changed = first
    .slice(0, 3)
    .map((q) => ({ ...q, text: `更新例：${q.text}` }));
  const added: Question = {
    key,
    text: "更新例として追加した質問です",
    title: "デモ用の合成質問",
    url: "",
  };
  const dead = new Set(first.map((q) => q.key));
  const updated = catalog([
    ...changed,
    ...questions.filter((q) => !dead.has(q.key)),
    added,
  ]);
  const docs = (rows: Question[]): Doc[] =>
    rows.map(({ key, text }) => ({ key, order: key, texts: [text] }));
  const { base, delta, compact } = await buildSegments(
    docs(questions),
    docs([...changed, added]),
    [...dead],
    docs(updated),
  );

  const files = new Map<string, Uint8Array>(),
    encode = (v: unknown) => new TextEncoder().encode(`${JSON.stringify(v)}\n`);
  const put = (prefix: string, ext: string, data: Uint8Array) => {
    const name = `${prefix}.${digest(data).slice(0, 20)}.${ext}`;
    files.set(name, data);
    return name;
  };
  const segment = (prefix: string, data: Uint8Array) => {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    return {
      id: view.getBigUint64(24, true).toString(16).padStart(16, "0"),
      url: put(prefix, "asix", data),
      bytes: data.length,
      texts: view.getUint32(36, true),
      integrity: `sha384-${createHash("sha384").update(data).digest("base64")}`,
    };
  };
  const b = segment("base", base),
    d = segment("delta", delta),
    c = segment("compact", compact);
  const baseCatalog = encode(questions),
    nextCatalog = encode(updated);
  const catalogs = [baseCatalog, nextCatalog, nextCatalog];
  const stages = [[b], [b, d], [c]].map((segments, i) => {
    const manifest: Manifest = {
      format: "asearch-manifest/1",
      indexId: "auto-wiki-qa-questions",
      generation: i + 1,
      index: {
        major: 1,
        minor: 0,
        symbol_unit: "code-point",
        normalizer: { id: "ja-basic", version: 1, options: 31 },
      },
      segments,
    };
    const data = catalogs[i];
    if (!data) throw new Error("Missing catalog");
    return {
      manifest: put("manifest", "json", encode(manifest)),
      catalog: put("catalog", "json", data),
      catalogSha256: digest(data),
    };
  });
  files.set("release.json", encode({ stages, attribution } satisfies Release));
  return files;
}
