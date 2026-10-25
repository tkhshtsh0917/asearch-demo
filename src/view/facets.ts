/** Owns a native article selector without rendering thousands of options or custom focus behavior. */
import { type ArticleFacet, articleOptions } from "../shared/facets.ts";

interface Elements {
  filter: HTMLInputElement;
  select: HTMLSelectElement;
  clear: HTMLButtonElement;
  summary: HTMLElement;
  current: HTMLElement;
}

export class ArticleFilter {
  private facets: readonly ArticleFacet[] = [];
  private selected: string | undefined;
  private enabled = false;
  private readonly view: Elements;

  constructor(view: Elements, change: () => void) {
    this.view = view;
    view.filter.addEventListener("input", () => this.render());
    view.select.addEventListener("change", () => {
      this.selected =
        view.select.value === "" ? undefined : JSON.parse(view.select.value);
      this.render();
      change();
    });
    view.clear.addEventListener("click", () => {
      this.reset();
      change();
    });
    this.render();
  }

  get title(): string | undefined {
    return this.selected;
  }

  update(facets: readonly ArticleFacet[]) {
    this.facets = facets;
    this.render();
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    this.render();
  }

  reset() {
    this.selected = undefined;
    this.view.filter.value = "";
    this.render();
  }

  /** Preserves a selected article at count zero if a newer publication removes it. */
  private render() {
    const { options, matches } = articleOptions(
      this.facets,
      this.view.filter.value,
      this.selected,
    );
    const fragment = document.createDocumentFragment();
    const all = document.createElement("option");
    all.value = "";
    all.textContent = "すべての記事";
    fragment.append(all);
    for (const facet of options) {
      const option = document.createElement("option");
      option.value = JSON.stringify(facet.title);
      option.textContent = `${facet.title || "記事名なし"}（${facet.count.toLocaleString()}件）`;
      fragment.append(option);
    }
    this.view.select.replaceChildren(fragment);
    this.view.select.value =
      this.selected === undefined ? "" : JSON.stringify(this.selected);
    this.view.filter.disabled = !this.enabled;
    this.view.select.disabled = !this.enabled;
    this.view.clear.disabled = !this.enabled || this.selected === undefined;
    this.view.summary.textContent = `${matches.toLocaleString()}記事${matches > 50 ? "・先頭50件を表示。記事名で絞れます" : ""}。件数は現在の索引の収録質問数です。`;
    this.view.current.textContent =
      this.selected === undefined ? "" : ` · ${this.selected || "記事名なし"}`;
  }
}
