/** Controls responsive disclosure and moves owned focus before hiding content or its toggle. */
export interface FacetPanelElements {
  panel: HTMLElement;
  body: HTMLElement;
  toggle: HTMLButtonElement;
  filter: HTMLInputElement;
  focusTarget: HTMLElement;
}

export class FacetPanel {
  private readonly view: FacetPanelElements;
  private readonly narrow = window.matchMedia("(max-width: 800px)");
  private mobileOpen = false;

  constructor(view: FacetPanelElements) {
    this.view = view;
    view.toggle.addEventListener("click", () => {
      if (!this.narrow.matches) return;
      view.toggle.focus();
      this.mobileOpen = !this.mobileOpen;
      this.render();
    });
    this.narrow.addEventListener("change", () => this.render());
    this.render();
  }

  show(active: boolean) {
    if (!active && this.view.panel.contains(document.activeElement))
      this.view.focusTarget.focus();
    this.view.panel.hidden = !active;
    this.render();
  }

  private render() {
    const { panel, body, toggle, filter, focusTarget } = this.view;
    const narrow = this.narrow.matches,
      open = !narrow || this.mobileOpen;
    const active = document.activeElement;

    if (narrow) toggle.hidden = false;
    if (open) body.hidden = false;
    if (!open && body.contains(active)) toggle.focus();
    else if (!narrow && active === toggle)
      (filter.disabled ? focusTarget : filter).focus();

    body.hidden = !open;
    toggle.hidden = !narrow;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = open ? "閉じる" : "条件を開く";
    panel.dataset.open = String(open);
  }
}
