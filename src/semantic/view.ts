/** Keeps optional semantic results separate from primary rankings and facet counts. */
import type { SearchFilters, SemanticAvailability } from "../shared/facets.ts";
import { renderRows } from "../view/results.ts";
import type {
  SemanticContext,
  SemanticReply,
  SemanticRequest,
} from "./protocol.ts";

export class SemanticView {
  private worker: Worker | undefined;
  private context: SemanticContext | undefined;
  private token = 0;
  private enabled = false;
  private availabilityKnown = false;
  private manual = false;
  private text = "";
  private composing = false;
  private filters: SearchFilters = { articles: [], changes: [] };
  private primary: { total: number; ids: number[] } | undefined;
  private debounce: ReturnType<typeof setTimeout> | undefined;
  private timeout: ReturnType<typeof setTimeout> | undefined;
  private readonly button: HTMLButtonElement;
  private readonly status: HTMLElement;
  private readonly rows: HTMLElement;
  private readonly availability: (
    value: SemanticAvailability | undefined,
  ) => void;

  constructor(
    button: HTMLButtonElement,
    status: HTMLElement,
    rows: HTMLElement,
    availability: (value: SemanticAvailability | undefined) => void,
  ) {
    this.button = button;
    this.status = status;
    this.rows = rows;
    this.availability = availability;
    button.addEventListener("click", () => {
      clearTimeout(this.debounce);
      this.enabled = true;
      this.manual = true;
      button.textContent = "意味でも探す";
      this.run();
    });
  }

  setContext(context?: SemanticContext) {
    if (JSON.stringify(this.context) !== JSON.stringify(context))
      this.clear(true);
    this.context = context;
    this.button.disabled = !context;
    if (!context)
      this.setStatus(
        "この配信には意味検索用の資産が含まれていません。文字検索は利用できます。",
      );
  }

  update(text: string, filters: SearchFilters, composing: boolean) {
    this.clear();
    this.text = text;
    this.filters = filters;
    this.composing = composing;
    this.primary = undefined;
    this.manual = false;
  }

  accept(total: number, ids: number[]) {
    this.primary = { total, ids };
    clearTimeout(this.debounce);
    if (this.manual) this.run();
    else this.debounce = setTimeout(() => this.run(), 150);
  }

  dispose() {
    this.clear(true);
    this.worker?.terminate();
    this.worker = undefined;
  }

  private setStatus(text: string) {
    if (this.status.textContent !== text) this.status.textContent = text;
  }

  private clear(catalog = false) {
    ++this.token;
    clearTimeout(this.debounce);
    clearTimeout(this.timeout);
    this.worker?.postMessage({ kind: "cancel" } satisfies SemanticRequest);
    this.rows.replaceChildren();
    if (catalog) {
      this.availabilityKnown = false;
      this.availability(undefined);
    }

    this.setStatus("文字検索とは別に、意味が近い質問を提案します。");
  }

  private run() {
    if (
      !this.enabled ||
      !this.context ||
      !this.primary ||
      this.composing ||
      !this.text.trim() ||
      (!this.manual && this.primary.total !== 0)
    )
      return;
    this.manual = false;
    const token = ++this.token,
      context = this.context;
    this.worker ??= new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    const worker = this.worker;
    this.setStatus(
      "意味検索を準備・実行しています… 初回はモデルを取得します。文字検索は引き続き利用できます。",
    );
    clearTimeout(this.timeout);
    const fail = (message: string) => {
      if (token !== this.token) return;
      clearTimeout(this.timeout);
      worker.terminate();
      this.worker = undefined;
      this.setStatus(message);
    };
    this.timeout = setTimeout(
      () =>
        fail(
          "意味検索が時間内に完了しませんでした。ボタンから再試行できます。",
        ),
      180000,
    );
    worker.onerror = () =>
      fail("意味検索Workerが停止しました。ボタンから再試行できます。");
    worker.onmessage = (event: MessageEvent<SemanticReply>) => {
      const reply = event.data;
      if (reply.token !== this.token || token !== this.token) return;
      if (reply.kind === "catalog") {
        if (
          reply.stage === context.stage &&
          reply.catalogSha256 === context.catalogSha256
        )
          if (!this.availabilityKnown) {
            this.availabilityKnown = true;
            this.availability(reply.available);
          }

        return;
      }

      clearTimeout(this.timeout);
      if (reply.kind === "error") {
        this.rows.replaceChildren();
        this.setStatus(
          `意味検索を利用できません: ${reply.message}。ボタンから再試行できます。`,
        );
        return;
      }

      if (
        reply.stage !== context.stage ||
        reply.catalogSha256 !== context.catalogSha256
      ) {
        fail("意味検索の配信情報が一致しません。ボタンから再試行できます。");
        return;
      }

      renderRows(
        this.rows,
        reply.rows.map((q) => ({
          ...q,
          level: 0,
          spans: [],
          semanticDistance: q.distance,
        })),
      );
      this.rows.dataset.token = String(token);
      this.rows.dataset.stage = String(reply.stage);
      this.setStatus(
        `意味が近い質問を${reply.rows.length}件提案 · ${reply.elapsed.toFixed(1)} ms。正解や一致件数を示すものではありません。`,
      );
    };
    worker.postMessage({
      kind: "query",
      token,
      base: new URL(`${import.meta.env.BASE_URL}semantic/`, location.origin)
        .href,
      context,
      text: this.text,
      filters: this.filters,
      exclude: this.primary.ids,
    } satisfies SemanticRequest);
  }
}
