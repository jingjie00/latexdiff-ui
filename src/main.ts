import "./style.css";
import { LatexDiff } from "wasm-latex-tools";
import type { LatexDiffOptions } from "wasm-latex-tools";
import { setColumnContent, wireColumn, type ColumnSetup } from "./column";
import { setCopyEnabled, wireCopyButton } from "./copy";
import { filenameFromHint, setDownloadEnabled, wireDownloadButton } from "./download";
import { wireLineNumbers } from "./line-numbers";
import { wirePlainPaste } from "./paste";
import { initBuildTime } from "./build-time";
import { initPopover } from "./popover";
import { initOptionsPanel } from "./options-panel";
import { initTheme } from "./theme";
import { highlightLatexDiff } from "./diff-highlight";
import { DEMO_NEW_LABEL, DEMO_OLD_LABEL, getDemoNew, getDemoOld } from "./samples";
import {
  ensureRunner,
  getLoadError,
  getLoadLog,
  getLoadProgress,
  getRunnerState,
  onLoadLogChange,
  onLoadProgressChange,
  onRunnerStateChange,
  startBackgroundLoad,
} from "./runner";

const statusBar = document.getElementById("status-bar")!;
const statusText = document.getElementById("status-text")!;
const statusDot = document.getElementById("status-dot")!;
const loadProgress = document.getElementById("load-progress")!;
const loadProgressFill = document.getElementById("load-progress-fill")!;
const loadProgressPct = document.getElementById("load-progress-pct")!;
const markupType = document.getElementById("markup-type") as HTMLSelectElement;
const markupSubtype = document.getElementById("markup-subtype") as HTMLSelectElement;
const floatType = document.getElementById("float-type") as HTMLSelectElement;
const mathMarkup = document.getElementById("math-markup") as HTMLSelectElement;
const encoding = document.getElementById("encoding") as HTMLSelectElement;
const flatten = document.getElementById("flatten") as HTMLInputElement;
const allowSpaces = document.getElementById("allow-spaces") as HTMLInputElement;
const runBtn = document.getElementById("run-btn") as HTMLButtonElement;
const oldCopyBtn = document.getElementById("old-copy-btn") as HTMLButtonElement;
const newCopyBtn = document.getElementById("new-copy-btn") as HTMLButtonElement;
const trackedCopyBtn = document.getElementById("tracked-copy-btn") as HTMLButtonElement;
const oldDownloadBtn = document.getElementById("old-download-btn") as HTMLButtonElement;
const newDownloadBtn = document.getElementById("new-download-btn") as HTMLButtonElement;
const trackedDownloadBtn = document.getElementById("tracked-download-btn") as HTMLButtonElement;
const errorBanner = document.getElementById("error-banner")!;
const themeToggle = document.getElementById("theme-toggle") as HTMLButtonElement;
const demoBtn = document.getElementById("demo-btn") as HTMLButtonElement;
const swapBtns = document.querySelectorAll<HTMLButtonElement>(".swap-btn");

const oldEditor = document.getElementById("old-editor") as HTMLTextAreaElement;
const newEditor = document.getElementById("new-editor") as HTMLTextAreaElement;
const trackedEditor = document.getElementById("tracked-editor") as HTMLTextAreaElement;
const oldHint = document.getElementById("old-hint")!;
const newHint = document.getElementById("new-hint")!;
const trackedHint = document.getElementById("tracked-hint")!;
const trackedPreview = document.getElementById("tracked-preview")!;
const viewSourceBtn = document.getElementById("view-source-btn") as HTMLButtonElement;
const viewPreviewBtn = document.getElementById("view-preview-btn") as HTMLButtonElement;
const previewLegend = document.getElementById("preview-legend")!;

const editors = [oldEditor, newEditor, trackedEditor];

let trackedView: "source" | "preview" = "source";

const refreshOldLines = wireLineNumbers(
  document.getElementById("old-line-numbers")!,
  () => oldEditor.value,
  oldEditor,
);

const refreshNewLines = wireLineNumbers(
  document.getElementById("new-line-numbers")!,
  () => newEditor.value,
  newEditor,
);

const refreshTrackedLines = wireLineNumbers(
  document.getElementById("tracked-line-numbers")!,
  () => trackedEditor.value,
  trackedEditor,
  trackedPreview,
);

const oldColumn: ColumnSetup = {
  wrap: oldEditor.closest("[data-drop-target]") as HTMLElement,
  textarea: oldEditor,
  hint: oldHint,
  onChange: () => {
    updateActions();
    refreshOldLines();
  },
};

const newColumn: ColumnSetup = {
  wrap: newEditor.closest("[data-drop-target]") as HTMLElement,
  textarea: newEditor,
  hint: newHint,
  onChange: () => {
    updateActions();
    refreshNewLines();
  },
};

const trackedColumn: ColumnSetup = {
  wrap: trackedEditor.closest("[data-drop-target]") as HTMLElement,
  textarea: trackedEditor,
  hint: trackedHint,
  onChange: () => {
    updateActions();
    refreshTrackedLines();
    if (trackedView === "preview") {
      renderTrackedPreview();
    }
  },
};

function setStatus(kind: "loading" | "ready" | "error", text: string) {
  statusBar.classList.remove("ready", "error");
  if (kind === "ready") statusBar.classList.add("ready");
  if (kind === "error") statusBar.classList.add("error");
  statusText.textContent = text;
}

function hideError() {
  errorBanner.classList.add("hidden");
  errorBanner.textContent = "";
}

function showError(message: string) {
  errorBanner.textContent = message;
  errorBanner.classList.remove("hidden");
}

function loadStatusLine(): string {
  const logs = getLoadLog();
  const last = logs[logs.length - 1];
  if (last) {
    return last.replace(/^\d{2}:\d{2}:\d{2}\s+/, "");
  }
  return getLoadProgress().message;
}

function updateLoadProgressUI() {
  const rs = getRunnerState();
  const p = getLoadProgress();
  const logs = getLoadLog();

  if (rs === "loading") {
    loadProgress.classList.remove("hidden");
    loadProgress.setAttribute("aria-hidden", "false");
    loadProgressPct.classList.remove("hidden");
    const line = loadStatusLine();
    statusText.textContent = line;
    loadProgressFill.style.width = `${p.percent}%`;
    loadProgress.setAttribute("aria-valuenow", String(Math.round(p.percent)));
    loadProgressPct.textContent = `${Math.round(p.percent)}%`;
    statusBar.title = logs.length > 0 ? logs.join("\n") : p.detail || p.message;
    setStatus("loading", line);
    return;
  }

  loadProgress.classList.add("hidden");
  loadProgress.setAttribute("aria-hidden", "true");
  loadProgressPct.classList.add("hidden");
  statusBar.removeAttribute("title");

  if (rs === "ready") {
    setStatus("ready", "Ready — paste into Old and New, then Generate");
  } else if (rs === "error") {
    const msg = getLoadError() ?? p.detail ?? "Unknown error";
    const logTail = logs.slice(-6).join("\n");
    const line = loadStatusLine() || "Engine failed to load";
    setStatus("error", line);
    statusText.textContent = line;
    statusBar.title = logTail ? `${msg}\n\n${logTail}` : msg;
    statusDot.setAttribute("title", msg);
  } else {
    setStatus("ready", "Ready — paste into Old and New");
  }
}

function syncRunnerStatus() {
  updateLoadProgressUI();
}

function updateActions() {
  const hasOld = oldEditor.value.trim().length > 0;
  const hasNew = newEditor.value.trim().length > 0;
  const hasTracked = trackedEditor.value.trim().length > 0;
  setCopyEnabled(oldCopyBtn, hasOld);
  setCopyEnabled(newCopyBtn, hasNew);
  setCopyEnabled(trackedCopyBtn, hasTracked);
  setDownloadEnabled(oldDownloadBtn, hasOld);
  setDownloadEnabled(newDownloadBtn, hasNew);
  setDownloadEnabled(trackedDownloadBtn, hasTracked);
}

function buildDiffOptions(): Partial<LatexDiffOptions> {
  const opts: Partial<LatexDiffOptions> = {
    type: markupType.value as LatexDiffOptions["type"],
    floattype: floatType.value as "FLOATSAFE" | "IDENTICAL",
    encoding: encoding.value,
    mathMarkup: Number(mathMarkup.value),
    flatten: flatten.checked,
    allowSpaces: allowSpaces.checked,
  };
  if (markupSubtype.value) {
    opts.subtype = markupSubtype.value;
  }
  return opts;
}

function renderTrackedPreview() {
  const text = trackedEditor.value;
  if (!text.trim()) {
    trackedPreview.innerHTML =
      '<span class="preview-empty">Generate diff to see colored \\DIFadd / \\DIFdel preview here.</span>';
    return;
  }
  trackedPreview.innerHTML = highlightLatexDiff(text);
}

function setTrackedView(view: "source" | "preview") {
  trackedView = view;
  const isPreview = view === "preview";

  trackedEditor.classList.toggle("hidden", isPreview);
  trackedPreview.classList.toggle("hidden", !isPreview);
  previewLegend.classList.toggle("hidden", !isPreview);

  viewSourceBtn.classList.toggle("is-active", !isPreview);
  viewPreviewBtn.classList.toggle("is-active", isPreview);
  viewSourceBtn.setAttribute("aria-selected", String(!isPreview));
  viewPreviewBtn.setAttribute("aria-selected", String(isPreview));

  if (isPreview) {
    renderTrackedPreview();
  }
  refreshTrackedLines();
}

runBtn.addEventListener("click", async () => {
  const oldContent = oldEditor.value;
  const newContent = newEditor.value;
  if (!oldContent.trim() || !newContent.trim()) {
    showError("Paste or type content in both Old and New before generating.");
    return;
  }

  hideError();
  runBtn.classList.add("is-busy");
  const prevLabel = runBtn.textContent;
  runBtn.textContent =
    getRunnerState() === "ready" ? "Running…" : "Loading engine…";
  setStatus("loading", "Preparing latexdiff…");

  try {
    const activeRunner = await ensureRunner();
    runBtn.textContent = "Running…";
    setStatus("ready", "Running latexdiff…");
    const latexDiff = new LatexDiff(activeRunner);
    const result = await latexDiff.diff(oldContent, newContent, buildDiffOptions());

    setColumnContent(trackedColumn, result.output, "diff.tex (generated)");
    setTrackedView("preview");
    setStatus("ready", "Done — preview shows additions & deletions");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    showError(msg);
    setStatus("error", "Error — see message above");
    statusDot.setAttribute("title", msg);
  } finally {
    runBtn.textContent = prevLabel;
    runBtn.classList.remove("is-busy");
    updateActions();
  }
});

wireCopyButton(oldCopyBtn, () => oldEditor.value);
wireCopyButton(newCopyBtn, () => newEditor.value);
wireCopyButton(trackedCopyBtn, () => trackedEditor.value);

wireDownloadButton(
  oldDownloadBtn,
  () => oldEditor.value,
  () => filenameFromHint(oldHint, "old.tex"),
);
wireDownloadButton(
  newDownloadBtn,
  () => newEditor.value,
  () => filenameFromHint(newHint, "new.tex"),
);
wireDownloadButton(
  trackedDownloadBtn,
  () => trackedEditor.value,
  () => filenameFromHint(trackedHint, "diff.tex"),
);

function swapOldNew() {
  const oldText = oldEditor.value;
  const newText = newEditor.value;
  const oldLabel = oldHint.textContent ?? "x.tex";
  const newLabel = newHint.textContent ?? "y.tex";

  setColumnContent(oldColumn, newText, newLabel);
  setColumnContent(newColumn, oldText, oldLabel);
  hideError();
}

for (const btn of swapBtns) {
  btn.addEventListener("click", swapOldNew);
}

demoBtn.addEventListener("click", () => {
  hideError();
  setColumnContent(oldColumn, getDemoOld(), DEMO_OLD_LABEL);
  setColumnContent(newColumn, getDemoNew(), DEMO_NEW_LABEL);
  setColumnContent(trackedColumn, "", "diff.tex");
  setTrackedView("source");
  setStatus(
    getRunnerState() === "ready" ? "ready" : "loading",
    getRunnerState() === "ready"
      ? "Demo loaded — click Generate"
      : "Demo loaded — engine still loading…",
  );
  updateActions();
});

viewSourceBtn.addEventListener("click", () => setTrackedView("source"));
viewPreviewBtn.addEventListener("click", () => setTrackedView("preview"));

trackedEditor.addEventListener("input", () => {
  if (trackedView === "preview") {
    renderTrackedPreview();
  }
});

function onFilePaste(editor: HTMLTextAreaElement, file: File) {
  const column =
    editor === oldEditor ? oldColumn : editor === newEditor ? newColumn : trackedColumn;
  column.hint.dataset.fromFile = "1";
  column.hint.dataset.defaultName = column.hint.textContent ?? "";
  column.hint.textContent = file.name;
  column.hint.title = file.name;
}

initBuildTime(document.getElementById("build-time")!);
initTheme(themeToggle);
initPopover(
  document.querySelector(".tutorial-wrap")!,
  document.getElementById("tutorial-btn") as HTMLButtonElement,
  document.getElementById("tutorial-popover")!,
);
initPopover(
  document.querySelector(".info-wrap")!,
  document.getElementById("info-btn") as HTMLButtonElement,
  document.getElementById("info-popover")!,
);
initOptionsPanel(
  document.getElementById("options-panel")!,
  document.getElementById("options-toggle") as HTMLButtonElement,
  document.getElementById("options-body")!,
  document.getElementById("options-summary")!,
  {
    markupType,
    markupSubtype,
    floatType,
    mathMarkup,
    encoding,
    flatten,
    allowSpaces,
  },
);
wirePlainPaste(editors, onFilePaste);
wireColumn(oldColumn);
wireColumn(newColumn);
wireColumn(trackedColumn);

onLoadProgressChange(() => {
  updateLoadProgressUI();
});

onLoadLogChange(() => {
  updateLoadProgressUI();
});

onRunnerStateChange((rs) => {
  if (rs === "error") {
    const msg = getLoadError() ?? "Engine failed to load";
    const logTail = getLoadLog().slice(-8).join("\n");
    showError(logTail ? `${msg}\n\n${logTail}` : msg);
  }
  syncRunnerStatus();
  updateActions();
});

setStatus("ready", "Ready — paste into Old and New");
updateActions();
startBackgroundLoad();
