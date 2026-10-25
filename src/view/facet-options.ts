/** Renders native checkbox options as text and restores keyboard focus after updates. */
export interface FacetOption {
  value: string;
  label: string;
  count: number;
  checked: boolean;
  disabled: boolean;
}

export function renderOptions(
  target: HTMLElement,
  options: readonly FacetOption[],
) {
  const active = document.activeElement;
  const focused =
    active instanceof HTMLInputElement && target.contains(active)
      ? active.value
      : undefined;
  const fragment = document.createDocumentFragment();
  let nextFocus: HTMLInputElement | undefined;
  for (const option of options) {
    const label = document.createElement("label"),
      input = document.createElement("input");
    label.className = "facet-option";
    input.type = "checkbox";
    input.value = option.value;
    input.checked = option.checked;
    input.disabled = option.disabled;
    const name = document.createElement("span"),
      count = document.createElement("span");
    name.className = "facet-name";
    name.textContent = option.label;
    count.className = "facet-count";
    count.textContent = `（${option.count.toLocaleString()}件）`;
    label.append(input, name, count);
    fragment.append(label);
    if (option.value === focused && !input.disabled) nextFocus = input;
  }
  target.replaceChildren(fragment);
  nextFocus?.focus({ preventScroll: true });
}
