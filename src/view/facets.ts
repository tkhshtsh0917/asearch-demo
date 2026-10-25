/** Owns facet selections, bounded native checkboxes and removable selection chips. */
import {
  articleOptions,
  type ChangeFilter,
  changeKinds,
  type Facets,
  MAX_SELECTED_ARTICLES,
  type SearchFilters,
} from "../shared/facets.ts";
import { renderOptions } from "./facet-options.ts";

interface Elements {
  panel: HTMLElement;
  layout: HTMLElement;
  toggle: HTMLButtonElement;
  filter: HTMLInputElement;
  articles: HTMLElement;
  changes: HTMLElement;
  clear: HTMLButtonElement;
  summary: HTMLElement;
  selected: HTMLElement;
  chips: HTMLElement;
  focusTarget: HTMLElement;
}

const changeLabels: Record<ChangeFilter, string> = {
  unchanged: "初期の質問",
  added: "追加された質問",
  updated: "変更された質問",
};

export class SearchFacets {
  private facets: Facets = { articles: [], changes: [] };
  private readonly articles = new Set<string>();
  private readonly changes = new Set<ChangeFilter>();
  private enabled = false;
  private readonly view: Elements;
  private readonly change: () => void;

  constructor(view: Elements, change: () => void) {
    this.view = view;
    this.change = change;
    view.filter.addEventListener("input", () => this.render());
    view.articles.addEventListener("change", (event) =>
      this.select(event, "articles"),
    );
    view.changes.addEventListener("change", (event) =>
      this.select(event, "changes"),
    );
    view.clear.addEventListener("click", () => {
      this.reset();
      change();
      view.focusTarget.focus();
    });
    view.toggle.addEventListener("click", () => {
      const open = view.toggle.getAttribute("aria-expanded") !== "true";
      view.toggle.setAttribute("aria-expanded", String(open));
      view.toggle.textContent = open ? "閉じる" : "条件を開く";
      view.panel.dataset.open = String(open);
    });
    this.render();
  }

  get filters(): SearchFilters {
    return { articles: [...this.articles], changes: [...this.changes] };
  }

  get count(): number {
    return this.articles.size + this.changes.size;
  }

  update(facets: Facets, active: boolean) {
    this.facets = facets;
    this.show(active);
    this.render();
  }

  show(active: boolean) {
    this.view.panel.hidden = !active;
    this.view.layout.dataset.active = String(active);
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    this.render();
  }

  reset() {
    this.articles.clear();
    this.changes.clear();
    this.view.filter.value = "";
    this.render();
  }

  private select(event: Event, group: "articles" | "changes") {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !this.enabled) return;
    if (group === "articles") {
      if (input.checked && this.articles.size < MAX_SELECTED_ARTICLES)
        this.articles.add(input.value);
      else this.articles.delete(input.value);
    } else if (changeKinds.includes(input.value as ChangeFilter)) {
      const kind = input.value as ChangeFilter;
      if (input.checked) this.changes.add(kind);
      else this.changes.delete(kind);
    }
    this.render();
    this.change();
  }

  /** Counts exclude this group's own selection, so sibling choices stay available. */
  private render() {
    const { options, matches } = articleOptions(
      this.facets.articles,
      this.view.filter.value,
      [...this.articles],
    );
    renderOptions(
      this.view.articles,
      options.map((facet) => ({
        value: facet.title,
        label: facet.title || "記事名なし",
        count: facet.count,
        checked: this.articles.has(facet.title),
        disabled:
          !this.enabled ||
          (!this.articles.has(facet.title) &&
            (facet.count === 0 || this.articles.size >= MAX_SELECTED_ARTICLES)),
      })),
    );
    renderOptions(
      this.view.changes,
      changeKinds.map((kind) => ({
        value: kind,
        label: changeLabels[kind],
        count:
          this.facets.changes.find((facet) => facet.kind === kind)?.count ?? 0,
        checked: this.changes.has(kind),
        disabled:
          !this.enabled ||
          (!this.changes.has(kind) &&
            !this.facets.changes.some(
              (facet) => facet.kind === kind && facet.count > 0,
            )),
      })),
    );
    this.view.filter.disabled = !this.enabled;
    this.view.clear.disabled = !this.enabled || this.count === 0;
    this.view.selected.textContent = this.count
      ? `${this.count}件選択中`
      : "未選択";
    this.view.summary.textContent = `${matches.toLocaleString()}記事${matches > 50 ? "・先頭50件と選択中の記事を表示" : ""}。件数はキーワードと更新状態による候補数です。記事は最大50件選べます。`;
    this.renderChips();
  }

  private renderChips() {
    const fragment = document.createDocumentFragment();
    const add = (label: string, remove: () => void) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${label} ×`;
      button.setAttribute("aria-label", `${label}の絞り込みを解除`);
      button.disabled = !this.enabled;
      button.addEventListener("click", () => {
        remove();
        this.render();
        this.change();
        this.view.focusTarget.focus();
      });
      fragment.append(button);
    };
    for (const title of this.articles)
      add(`記事：${title || "記事名なし"}`, () => this.articles.delete(title));
    for (const kind of this.changes)
      add(changeLabels[kind], () => this.changes.delete(kind));
    this.view.chips.replaceChildren(fragment);
    this.view.chips.hidden = this.count === 0;
  }
}
