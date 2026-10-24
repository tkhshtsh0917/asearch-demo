/** Explains content changes and index consolidation without changing search input. */
import type { Response } from "../shared/protocol.ts";

type State = Extract<Response, { kind: "state" }>;
export interface DeliveryView {
  status: HTMLElement;
  detail: HTMLElement;
  advance: HTMLButtonElement;
  restore: HTMLButtonElement;
  steps: HTMLElement[];
}

/** Marks the adopted stage only; a pending or failed update never advances the walkthrough. */
export function renderDelivery(view: DeliveryView, state?: State): void {
  for (const [index, step] of view.steps.entries()) {
    if (state && index === state.stage)
      step.setAttribute("aria-current", "step");
    else step.removeAttribute("aria-current");
    step.classList.toggle("complete", !!state && index < state.stage);
  }

  if (!state) {
    view.status.textContent = "索引を読み込んでいます…";
    view.detail.textContent =
      "準備ができたら、「更新例」で差分の前後を比べてみましょう。";
    view.advance.textContent = "差分を適用";
    view.advance.disabled = true;
    view.restore.disabled = true;
    return;
  }

  const { stage, busy, count, segments, updates } = state;
  view.status.textContent = `${count.toLocaleString()}件 · 世代 ${stage + 1} · 索引${segments}ファイル${busy ? " · 更新を取得中…" : " · 検索できます"}`;
  view.advance.textContent =
    stage === 0 ? "差分を適用" : stage === 1 ? "圧縮版へ切替" : "更新完了";
  view.advance.disabled = busy || stage >= 2;
  view.restore.disabled = busy || stage === 0;

  if (busy) {
    view.detail.textContent =
      state.pending === "restore"
        ? "差分前の索引を読み込んでいます。完了まで現在の内容を検索できます。"
        : stage === 0
          ? "差分を読み込んでいます。今の内容は引き続き検索できます。"
          : "同じ内容の単一索引を読み込んでいます。検索内容は変わりません。";
  } else if (stage === 0) {
    view.detail.textContent =
      "「更新例」はまだ0件。差分を適用すると、変更・追加された質問が見つかります。";
  } else if (stage === 1) {
    view.detail.textContent = `追加${updates.added}件・変更${updates.updated}件・削除${updates.removed}件を反映しました。「更新例」で追加・変更された質問を確認できます。次は検索内容を保ったまま、基本索引と差分を1ファイルにまとめた版へ切り替えます。`;
  } else {
    view.detail.textContent =
      "検索結果と追加・変更のラベルはそのまま。基本索引と差分をまとめ、索引が2ファイルから1ファイルになりました。";
  }
}
