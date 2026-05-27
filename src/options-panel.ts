const STORAGE_KEY = "latexdiff-options-collapsed";

import { resetDiffOptionsForm, type DiffOptionsFormElements } from "./diff-options-form";
import type { AppLayout } from "./layout";

export type OptionsSummaryInputs = DiffOptionsFormElements;

function summarizeList(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (v.length <= 18) return v;
  return `${v.slice(0, 16)}…`;
}

function buildOptionsSummary(inputs: OptionsSummaryInputs): string {
  const parts: string[] = [inputs.markupType.value];
  if (inputs.markupSubtype.value.trim()) {
    parts.push(inputs.markupSubtype.value.trim());
  }
  parts.push(
    inputs.floatType.value,
    `math ${inputs.mathMarkup.value}`,
    `fig ${inputs.graphicsMarkup.value}`,
    inputs.encoding.value,
  );
  if (inputs.flatten.checked) parts.push("flatten");
  if (inputs.allowSpaces.checked) parts.push("allow-spaces");
  if (inputs.noDel.checked) parts.push("no-del");
  if (inputs.disableCitationMarkup.checked) parts.push("no-cite-markup");
  if (inputs.disableAutoMbox.checked) parts.push("no-auto-mbox");
  const appendSafe = summarizeList(inputs.appendSafecmd.value);
  if (appendSafe) parts.push(`+safe ${appendSafe}`);
  return parts.join(" · ");
}

import { getEffectiveLayout } from "./layout";

/** Stacked sidebar with fixed heading — desktop stacked layout only. */
function useStackedSidebarOptions(): boolean {
  return getEffectiveLayout() === "stacked";
}

export function initOptionsPanel(
  panel: HTMLElement,
  toggleBtn: HTMLButtonElement,
  resetBtn: HTMLButtonElement,
  body: HTMLElement,
  summaryEl: HTMLElement,
  inputs: OptionsSummaryInputs,
): () => void {
  let classicCollapsed = localStorage.getItem(STORAGE_KEY) === "1";

  function setClassicCollapsed(next: boolean) {
    classicCollapsed = next;
    panel.classList.toggle("is-collapsed", next);
    toggleBtn.setAttribute("aria-expanded", String(!next));
    body.hidden = next;
    summaryEl.hidden = !next;
    summaryEl.textContent = buildOptionsSummary(inputs);
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  }

  function refreshSummary() {
    if (!useStackedSidebarOptions() && panel.classList.contains("is-collapsed")) {
      summaryEl.textContent = buildOptionsSummary(inputs);
    }
  }

  function syncLayoutMode(_layout?: AppLayout): void {
    const fixedSidebar = useStackedSidebarOptions();
    panel.classList.toggle("options-panel-fixed", fixedSidebar);
    resetBtn.hidden = false;
    if (fixedSidebar) {
      panel.classList.remove("is-collapsed");
      body.hidden = false;
      toggleBtn.hidden = true;
      summaryEl.hidden = true;
      return;
    }
    toggleBtn.hidden = false;
    setClassicCollapsed(classicCollapsed);
  }

  toggleBtn.addEventListener("click", () => {
    if (useStackedSidebarOptions()) return;
    setClassicCollapsed(!panel.classList.contains("is-collapsed"));
  });

  resetBtn.addEventListener("click", () => {
    resetDiffOptionsForm(inputs);
    refreshSummary();
  });

  const watch: (HTMLElement | HTMLInputElement | HTMLSelectElement)[] = [
    inputs.markupType,
    inputs.markupSubtype,
    inputs.floatType,
    inputs.mathMarkup,
    inputs.graphicsMarkup,
    inputs.encoding,
    inputs.flatten,
    inputs.allowSpaces,
    inputs.noDel,
    inputs.disableCitationMarkup,
    inputs.disableAutoMbox,
    inputs.appendSafecmd,
    inputs.excludeSafecmd,
    inputs.appendTextcmd,
    inputs.excludeTextcmd,
  ];

  for (const el of watch) {
    el.addEventListener("change", refreshSummary);
    if (el instanceof HTMLInputElement && el.type === "text") {
      el.addEventListener("input", refreshSummary);
    }
  }

  syncLayoutMode();

  return syncLayoutMode;
}
