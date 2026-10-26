/** Keeps selection buttons alive across count updates so pending keyboard activation survives. */
export interface SelectionChip {
  key: string;
  label: string;
  remove: () => void;
}

interface Entry {
  button: HTMLButtonElement;
  remove: () => void;
}

export class FacetChips {
  private readonly entries = new Map<string, Entry>();
  private readonly target: HTMLElement;
  private readonly focusTarget: HTMLElement;
  private readonly changed: () => void;

  constructor(
    target: HTMLElement,
    focusTarget: HTMLElement,
    changed: () => void,
  ) {
    this.target = target;
    this.focusTarget = focusTarget;
    this.changed = changed;
  }

  update(chips: readonly SelectionChip[], enabled: boolean) {
    const keys = new Set(chips.map((chip) => chip.key));
    for (const [key, entry] of this.entries) {
      if (keys.has(key)) continue;
      if (document.activeElement === entry.button) this.focusTarget.focus();
      entry.button.remove();
      this.entries.delete(key);
    }

    let next = this.target.firstElementChild;
    for (const chip of chips) {
      let entry = this.entries.get(chip.key);
      if (!entry) {
        entry = this.create(chip);
        this.entries.set(chip.key, entry);
      }
      entry.remove = chip.remove;
      const { button } = entry;
      const text = `${chip.label} ×`;
      if (button.textContent !== text) button.textContent = text;
      button.setAttribute("aria-label", `${chip.label}の絞り込みを解除`);
      button.disabled = !enabled;
      if (button !== next) this.target.insertBefore(button, next);
      next = button.nextElementSibling;
    }
    this.target.hidden = chips.length === 0;
  }

  private create(chip: SelectionChip): Entry {
    const button = document.createElement("button");
    button.type = "button";
    const entry = { button, remove: chip.remove };
    button.addEventListener("click", () => {
      entry.remove();
      this.changed();
      this.focusTarget.focus();
    });
    return entry;
  }
}
