const STORAGE_KEY = "latexdiff-options-collapsed";

export interface OptionsSummaryInputs {
  markupType: HTMLSelectElement;
  markupSubtype: HTMLSelectElement;
  floatType: HTMLSelectElement;
  mathMarkup: HTMLSelectElement;
  encoding: HTMLSelectElement;
  flatten: HTMLInputElement;
  allowSpaces: HTMLInputElement;
}

function buildOptionsSummary(inputs: OptionsSummaryInputs): string {
  const parts: string[] = [inputs.markupType.value];
  if (inputs.markupSubtype.value) {
    parts.push(inputs.markupSubtype.value);
  }
  parts.push(inputs.floatType.value, `math ${inputs.mathMarkup.value}`, inputs.encoding.value);
  if (inputs.flatten.checked) parts.push("flatten");
  if (inputs.allowSpaces.checked) parts.push("allow-spaces");
  return parts.join(" · ");
}

export function initOptionsPanel(
  panel: HTMLElement,
  toggleBtn: HTMLButtonElement,
  body: HTMLElement,
  summaryEl: HTMLElement,
  inputs: OptionsSummaryInputs,
): void {
  const stored = localStorage.getItem(STORAGE_KEY);
  const collapsed = stored === "1";

  function setCollapsed(next: boolean) {
    panel.classList.toggle("is-collapsed", next);
    toggleBtn.setAttribute("aria-expanded", String(!next));
    body.hidden = next;
    summaryEl.hidden = !next;
    summaryEl.textContent = buildOptionsSummary(inputs);
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  }

  function refreshSummary() {
    if (panel.classList.contains("is-collapsed")) {
      summaryEl.textContent = buildOptionsSummary(inputs);
    }
  }

  setCollapsed(collapsed);

  toggleBtn.addEventListener("click", () => {
    setCollapsed(!panel.classList.contains("is-collapsed"));
  });

  for (const el of [
    inputs.markupType,
    inputs.markupSubtype,
    inputs.floatType,
    inputs.mathMarkup,
    inputs.encoding,
    inputs.flatten,
    inputs.allowSpaces,
  ]) {
    el.addEventListener("change", refreshSummary);
  }
}
