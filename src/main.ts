/** Coordinates IME input, Worker generations and rendering of accepted responses. */
import type { Request, Response } from "./shared/protocol.ts";
import { type DeliveryView, renderDelivery } from "./view/delivery.ts";
import { SearchErrors } from "./view/errors.ts";
import { SearchFacets } from "./view/facets.ts";
import { renderRows } from "./view/results.ts";
import "./styles.css";

function element<T extends HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (!value) throw new Error(`Missing ${id}`);
  return value as T;
}

const input = element<HTMLInputElement>("query"),
  status = element("status"),
  results = element("results"),
  metrics = element("metrics"),
  advance = element<HTMLButtonElement>("advance");
const errors = new SearchErrors(element("error"));

const delivery: DeliveryView = {
  status,
  advance,
  restore: element<HTMLButtonElement>("restore"),
  detail: element("delivery-detail"),
  steps: [...document.querySelectorAll<HTMLElement>("[data-stage]")],
};
const changeLegend = element("change-legend");
const facets = new SearchFacets(
  {
    filter: element<HTMLInputElement>("article-search"),
    panel: element("filters"),
    layout: element("search-layout"),
    toggle: element<HTMLButtonElement>("filters-toggle"),
    articles: element("article-options"),
    changes: element("change-options"),
    clear: element<HTMLButtonElement>("filters-clear"),
    summary: element("article-summary"),
    selected: element("filters-selected"),
    chips: element("active-filters"),
    focusTarget: input,
  },
  query,
);

let worker: Worker,
  serial = 0,
  latest = 0,
  epoch = 0,
  stage = 0,
  composing = false,
  queued = false,
  loaded = false,
  run = 0;

function send(request: Request) {
  worker.postMessage(request);
}

/** Searches the current input value, including uncommitted IME text. */
function query() {
  latest = ++serial;
  changeLegend.hidden = stage === 0;
  if (!loaded) return;
  send({
    kind: "query",
    id: latest,
    pattern: input.value,
    filters: facets.filters,
  });
}

/** Coalesces input events while immediately invalidating earlier responses. */
function schedule() {
  latest = ++serial;
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    query();
  });
}

/** Updates the displayed generation and reruns the latest input after adoption. */
function handleState(message: Extract<Response, { kind: "state" }>) {
  const changed = stage !== message.stage;
  stage = message.stage;
  epoch = message.epoch;

  loaded = true;
  facets.setEnabled(true);
  renderDelivery(delivery, message);

  element("creator").textContent = message.creator;
  element("changes").textContent = message.changes;
  if (changed) errors.clearOperation();

  query();
}

/** Checks result identity again at paint time so queued frames cannot show stale data. */
function handleResults(
  message: Extract<Response, { kind: "results" }>,
  generation: number,
) {
  const accepted = () =>
    generation === run && message.id === latest && message.epoch === epoch;
  if (!accepted()) return;

  requestAnimationFrame(() => {
    if (!accepted()) return;
    facets.update(
      message.facets,
      Boolean(input.value.trim()) || facets.count > 0,
    );
    renderRows(results, message.rows);
    metrics.textContent =
      input.value.trim() || facets.count > 0
        ? `${message.totalIsExact === false ? "少なくとも" : ""}${message.total.toLocaleString()}件一致 · 上位${message.rows.length}件 · Worker内検索・説明 ${message.elapsed.toFixed(2)} ms${message.stats ? ` · ${message.stats.engine}` : ""}`
        : "質問やキーワードを入力してください";
    errors.accept({ id: message.id, epoch: message.epoch, generation });
  });
}

/** Invalidates queued responses and disables commands until a fresh Worker starts. */
function stopWorker(message: string, statusText: string) {
  loaded = false;
  facets.setEnabled(false);
  ++run;
  latest = ++serial;
  worker.terminate();
  advance.disabled = true;
  delivery.restore.disabled = true;
  errors.clear();
  errors.operationFailed(message);
  status.textContent = statusText;
  delivery.detail.textContent =
    "再読み込みで検索Workerを起動し直してください。";
}

/** Replaces the Worker and resets only UI state owned by its generation. */
function start() {
  worker?.terminate();
  const generation = ++run;
  loaded = false;
  facets.setEnabled(false);
  epoch = 0;
  stage = 0;
  facets.show(false);
  latest = ++serial;
  errors.clear();
  renderDelivery(delivery);
  changeLegend.hidden = true;
  renderRows(results, []);
  metrics.textContent = "";

  worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  });

  worker.onmessage = (event: MessageEvent<Response>) => {
    if (generation !== run) return;
    const message = event.data;
    if (message.kind === "boot") {
      send({
        kind: "init",
        base: new URL(`${import.meta.env.BASE_URL}data/`, location.origin).href,
      });
      return;
    }
    if (message.kind === "error") {
      if (
        message.id !== undefined &&
        (message.id !== latest || message.epoch !== epoch)
      )
        return;
      const text = `処理できませんでした: ${message.message}`;
      if (message.fatal) {
        stopWorker(
          text,
          "読み込みに失敗しました。再読み込みで再試行できます。",
        );
      } else if (message.id !== undefined) {
        errors.queryFailed(text, {
          id: message.id,
          epoch: message.epoch,
          generation,
        });
      } else errors.operationFailed(text);
      return;
    }
    if (message.kind === "state") {
      handleState(message);
      return;
    }

    if (message.kind === "results") handleResults(message, generation);
  };

  worker.onerror = () => {
    if (generation === run) {
      stopWorker(
        "検索Workerが停止しました。再読み込みで再試行してください。",
        "検索を停止しました。再読み込みで再試行できます。",
      );
    }
  };
}

/** Connects DOM events to query scheduling, lifecycle and update commands. */
function bindEvents() {
  input.addEventListener("input", schedule);
  input.addEventListener("compositionstart", () => {
    composing = true;
    latest = ++serial;
  });
  input.addEventListener("compositionend", () => {
    composing = false;
    schedule();
  });
  advance.addEventListener("click", () => {
    errors.clearOperation();
    advance.disabled = true;
    send({ kind: "advance" });
  });
  delivery.restore.addEventListener("click", () => {
    errors.clearOperation();
    delivery.restore.disabled = true;
    send({ kind: "restore" });
  });
  element("reset").addEventListener("click", start);
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    "[data-query]",
  ))
    button.addEventListener("click", () => {
      input.value = button.dataset.query ?? "";
      facets.reset();
      facets.setEnabled(loaded);
      query();
      input.focus();
    });
  element("search").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!composing) query();
  });
  window.addEventListener("pagehide", (event) => {
    if (!event.persisted) worker.terminate();
  });
}

bindEvents();
start();
