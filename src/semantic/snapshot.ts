/** Loads matching catalogs and vector snapshots without partially adopting an application stage. */
import { VectorClient } from "../../integration/vectide/src/client.ts";
import type { PreparedSnapshot } from "../../integration/vectide/src/types.ts";
import { assetName, catalog, type Question } from "../shared/catalog.ts";
import { type ChangeKind, catalogChanges } from "../shared/changes.ts";
import { jsonAsset } from "../worker/load.ts";
import { type SemanticRelease, semanticRelease } from "./identity.ts";
import type { SemanticContext } from "./protocol.ts";

type PreparedPublication = {
  publication: SemanticRelease;
  handle: PreparedSnapshot;
  client: VectorClient;
  rows: Question[];
  changes: ReadonlyMap<number, ChangeKind>;
};

export class Publications {
  private pin = "";
  private readonly ready = new Map<number, PreparedPublication>();
  private client: VectorClient | undefined;
  private readonly snapshots = new Map<string, PreparedSnapshot>();
  async prepare(
    base: URL,
    context: SemanticContext,
    signal: AbortSignal,
  ): Promise<PreparedPublication> {
    signal.throwIfAborted();
    if (this.pin !== context.pin.sha256) {
      this.client?.dispose();
      this.client = undefined;
      this.snapshots.clear();
      this.ready.clear();
      this.pin = context.pin.sha256;
    }
    const cached = this.ready.get(context.stage);
    if (cached) {
      const stage = cached.publication.stages[context.stage];
      if (
        stage?.catalogSha256 !== context.catalogSha256 ||
        stage.lexicalManifest !== context.lexicalManifest
      )
        throw new Error("Lexical/vector publication mismatch");
      cached.client.adopt(cached.handle);
      return cached;
    }
    const data = new URL("../data/", base);
    const publication = semanticRelease(
      await jsonAsset(base, context.pin.url, 32768, context.pin.sha256, signal),
    );
    const stage = publication.stages[context.stage];
    if (
      !stage ||
      stage.catalogSha256 !== context.catalogSha256 ||
      stage.lexicalManifest !== context.lexicalManifest
    )
      throw new Error("Lexical/vector publication mismatch");
    const initial = publication.stages[0];
    if (!initial) throw new Error("Missing base catalog");
    const rows = catalog(
      await jsonAsset(
        data,
        stage.catalog,
        8 * 1024 ** 2,
        stage.catalogSha256,
        signal,
      ),
    );
    const baseRows =
      context.stage === 0
        ? rows
        : catalog(
            await jsonAsset(
              data,
              initial.catalog,
              8 * 1024 ** 2,
              initial.catalogSha256,
              signal,
            ),
          );
    signal.throwIfAborted();
    this.client ??= await VectorClient.create(
      new URL(`${publication.bindingsDirectory}/vectide_wasm.js`, base),
      new URL(`${publication.bindingsDirectory}/vectide_wasm_bg.wasm`, base),
    );
    let handle = this.snapshots.get(stage.vectorManifestSha256);
    if (!handle) {
      const manifestValue = await jsonAsset(
        base,
        stage.vectorManifest,
        128 * 1024,
        stage.vectorManifestSha256,
        signal,
      );
      const manifest = new TextEncoder().encode(JSON.stringify(manifestValue));
      handle = await this.client.prepare(
        manifest,
        async function* (artifact) {
          const response = await fetch(new URL(assetName(artifact.url), base), {
            credentials: "omit",
            redirect: "error",
            signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
          });
          if (!response.ok || !response.body)
            throw new Error("Vector artifact unavailable");
          for await (const chunk of response.body) {
            for (let offset = 0; offset < chunk.length; offset += 65536)
              yield chunk.subarray(offset, offset + 65536);
          }
        },
        signal,
      );
      this.snapshots.set(stage.vectorManifestSha256, handle);
    }
    if (
      handle.space !== stage.space ||
      handle.revision !== stage.catalogSha256 ||
      handle.rows !== rows.length
    )
      throw new Error("Vector/catalog identity mismatch");
    const bytes = new Uint8Array(8 + rows.length * 4),
      view = new DataView(bytes.buffer);
    view.setBigUint64(0, BigInt(rows.length), true);
    rows
      .map((q) => q.key)
      .sort((a, b) => a - b)
      .forEach((id, i) => {
        view.setUint32(8 + i * 4, id, true);
      });
    const live = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      (n) => n.toString(16).padStart(2, "0"),
    ).join("");
    if (live !== handle.live_ids)
      throw new Error("Vector/catalog live-ID mismatch");
    signal.throwIfAborted();
    this.client.adopt(handle);
    const map = (items: Question[]) => new Map(items.map((q) => [q.key, q]));
    const prepared = {
      publication,
      handle,
      client: this.client,
      rows,
      changes: catalogChanges(map(baseRows), map(rows)).byKey,
    };
    if (this.ready.size >= 3)
      throw new Error("Application publication cache limit");
    this.ready.set(context.stage, prepared);
    return prepared;
  }
}
