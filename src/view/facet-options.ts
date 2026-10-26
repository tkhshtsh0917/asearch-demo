/** Retains checkbox nodes and keyboard activation while updating counts, order and availability. */
export interface FacetOption {
  value: string;
  label: string;
  count: number;
  checked: boolean;
  disabled: boolean;
}

interface Entry {
  label: HTMLLabelElement;
  input: HTMLInputElement;
  name: HTMLSpanElement;
  count: HTMLSpanElement;
}

export class FacetOptions {
  private readonly target: HTMLElement;
  private readonly entries = new Map<string, Entry>();

  constructor(target: HTMLElement) {
    this.target = target;
  }

  update(options: readonly FacetOption[], fallback: HTMLElement) {
    const active = document.activeElement;
    const focused =
      active instanceof HTMLInputElement && this.target.contains(active)
        ? active.value
        : undefined;
    const desired = new Map(options.map((option) => [option.value, option]));
    let protectedEntry =
      focused === undefined ? undefined : this.entries.get(focused);
    if (
      focused !== undefined &&
      (!desired.has(focused) || desired.get(focused)?.disabled)
    ) {
      fallback.focus();
      protectedEntry = undefined;
    }

    for (const [value, entry] of this.entries) {
      if (desired.has(value)) continue;
      entry.label.remove();
      this.entries.delete(value);
    }

    const ordered: Entry[] = [];
    for (const option of options) {
      let entry = this.entries.get(option.value);
      if (!entry) {
        entry = this.create(option.value);
        this.entries.set(option.value, entry);
      }
      if (entry.input.checked !== option.checked)
        entry.input.checked = option.checked;
      if (entry.input.disabled !== option.disabled)
        entry.input.disabled = option.disabled;
      if (entry.name.textContent !== option.label)
        entry.name.textContent = option.label;
      const count = `（${option.count.toLocaleString()}件）`;
      if (entry.count.textContent !== count) entry.count.textContent = count;
      ordered.push(entry);
    }
    this.arrange(ordered, protectedEntry);
  }

  /** Reorders siblings around the focused label without detaching its input during a keypress. */
  private arrange(ordered: readonly Entry[], protectedEntry?: Entry) {
    let next = this.target.firstElementChild;
    for (const { label } of ordered) {
      if (label === next) next = label.nextElementSibling;
      else if (label === protectedEntry?.label) {
        while (next && next !== label) {
          const following = next.nextElementSibling;
          this.target.insertBefore(next, label.nextElementSibling);
          next = following;
        }
        next = label.nextElementSibling;
      } else {
        this.target.insertBefore(label, next);
        next = label.nextElementSibling;
      }
    }
  }

  private create(value: string): Entry {
    const label = document.createElement("label"),
      input = document.createElement("input");
    label.className = "facet-option";
    input.type = "checkbox";
    input.value = value;
    const name = document.createElement("span"),
      count = document.createElement("span");
    name.className = "facet-name";
    count.className = "facet-count";
    label.append(input, name, count);
    return { label, input, name, count };
  }
}
