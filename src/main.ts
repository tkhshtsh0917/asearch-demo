import type { Mode, Request, Response } from "./shared/protocol.ts";
import { renderRows } from "./view/results.ts";
import "./styles.css";

function element<T extends HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (!value) throw new Error(`Missing ${id}`);
  return value as T;
}
const input = element<HTMLInputElement>("query"),
  mode = element<HTMLSelectElement>("mode"),
  status = element("status"),
  results = element("results"),
  metrics = element("metrics"),
  advance = element<HTMLButtonElement>("advance"),
  error = element("error");
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
function query() {
  latest = ++serial;
  if (composing || !loaded) return;
  send({
    kind: "query",
    id: latest,
    pattern: input.value,
    mode: mode.value as Mode,
  });
}
function schedule() {
  latest = ++serial;
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    query();
  });
}
function start() {
  worker?.terminate();
  const generation = ++run;
  loaded = false;
  epoch = 0;
  stage = 0;
  latest = ++serial;
  error.textContent = "";
  status.textContent = "索引を読み込んでいます…";
  advance.disabled = true;
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
      if (message.id !== undefined && message.id !== latest) return;
      error.textContent = `処理できませんでした: ${message.message}`;
      if (message.fatal) {
        loaded = false;
        status.textContent =
          "読み込みに失敗しました。再読み込みで再試行できます。";
      }
      return;
    }
    if (message.kind === "state") {
      const changed = stage !== message.stage;
      stage = message.stage;
      epoch = stage;
      loaded = true;
      status.textContent = `${message.count.toLocaleString()}件 · 世代 ${stage + 1}${message.busy ? " · 更新を取得中…" : " · 検索できます"}`;
      advance.textContent =
        stage === 0 ? "差分を適用" : stage === 1 ? "圧縮版へ切替" : "更新完了";
      advance.disabled = message.busy || stage >= 2;
      element("creator").textContent = message.creator;
      element("changes").textContent = message.changes;
      if (changed) error.textContent = "";
      query();
      return;
    }
    if (message.kind === "results") {
      const accepted = () =>
        generation === run &&
        message.id === latest &&
        message.mode === mode.value &&
        message.epoch === epoch &&
        !composing;
      if (!accepted()) return;
      requestAnimationFrame(() => {
        if (!accepted()) return;
        renderRows(results, message.rows);
        metrics.textContent = input.value.trim()
          ? `${message.total.toLocaleString()}件一致 · 上位${message.rows.length}件 · Worker内検索・説明 ${message.elapsed.toFixed(2)} ms${message.stats ? ` · ${message.stats.engine}` : ""}`
          : "質問やキーワードを入力してください";
      });
    }
  };
  worker.onerror = () => {
    if (generation === run) {
      loaded = false;
      error.textContent =
        "検索Workerが停止しました。再読み込みで再試行してください。";
      advance.disabled = true;
    }
  };
}
input.addEventListener("input", schedule);
input.addEventListener("compositionstart", () => {
  composing = true;
  latest = ++serial;
});
input.addEventListener("compositionend", () => {
  composing = false;
  schedule();
});
mode.addEventListener("change", query);
advance.addEventListener("click", () => {
  error.textContent = "";
  advance.disabled = true;
  send({ kind: "advance" });
});
element("reset").addEventListener("click", start);
for (const button of document.querySelectorAll<HTMLButtonElement>(
  "[data-query]",
))
  button.addEventListener("click", () => {
    input.value = button.dataset.query ?? "";
    query();
    input.focus();
  });
element("search").addEventListener("submit", (event) => {
  event.preventDefault();
  query();
});
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) worker.terminate();
});
start();
