import "./style.css";
import { LatexDiff, WebPerlRunner } from "wasm-latex-tools";
import type { LatexDiffOptions } from "wasm-latex-tools";
import { setColumnContent, wireColumn, type ColumnSetup } from "./column";
import { setCopyEnabled, wireCopyButton } from "./copy";
import { wireLineNumbers } from "./line-numbers";
import { wirePlainPaste } from "./paste";
import { initTheme } from "./theme";
import { highlightLatexDiff } from "./diff-highlight";
import { DEMO_NEW_LABEL, DEMO_OLD_LABEL, getDemoNew, getDemoOld } from "./samples";

const statusBar = document.getElementById("status-bar")!;
const statusText = document.getElementById("status-text")!;
const statusDot = document.getElementById("status-dot")!;
const markupType = document.getElementById("markup-type") as HTMLSelectElement;
const markupSubtype = document.getElementById("markup-subtype") as HTMLSelectElement;
const floatType = document.getElementById("float-type") as HTMLSelectElement;
const mathMarkup = document.getElementById("math-markup") as HTMLSelectElement;
const encoding = document.getElementById("encoding") as HTMLSelectElement;
const flatten = document.getElementById("flatten") as HTMLInputElement;
const allowSpaces = document.getElementById("allow-spaces") as HTMLInputElement;
const runBtn = document.getElementById("run-btn") as HTMLButtonElement;
const downloadBtn = document.getElementById("download-btn") as HTMLButtonElement;
const oldCopyBtn = document.getElementById("old-copy-btn") as HTMLButtonElement;
const newCopyBtn = document.getElementById("new-copy-btn") as HTMLButtonElement;
const trackedCopyBtn = document.getElementById("tracked-copy-btn") as HTMLButtonElement;
const errorBanner = document.getElementById("error-banner")!;
const themeToggle = document.getElementById("theme-toggle") as HTMLButtonElement;
const demoBtn = document.getElementById("demo-btn") as HTMLButtonElement;

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

let runner: WebPerlRunner | null = null;
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

function updateActions() {
  const hasOld = oldEditor.value.trim().length > 0;
  const hasNew = newEditor.value.trim().length > 0;
  runBtn.disabled = !runner || !hasOld || !hasNew;
  const hasTracked = trackedEditor.value.trim().length > 0;
  downloadBtn.disabled = !hasTracked;
  setCopyEnabled(oldCopyBtn, hasOld);
  setCopyEnabled(newCopyBtn, hasNew);
  setCopyEnabled(trackedCopyBtn, hasTracked);
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

function downloadDiff() {
  const text = trackedEditor.value;
  if (!text.trim()) return;

  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "diff.tex";
  a.click();
  URL.revokeObjectURL(url);
}

runBtn.addEventListener("click", async () => {
  if (!runner) return;

  const oldContent = oldEditor.value;
  const newContent = newEditor.value;
  if (!oldContent.trim() || !newContent.trim()) return;

  hideError();
  runBtn.disabled = true;
  downloadBtn.disabled = true;
  const prevLabel = runBtn.textContent;
  runBtn.textContent = "Running…";
  setStatus("ready", "Running latexdiff…");

  try {
    const latexDiff = new LatexDiff(runner);
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
    updateActions();
  }
});

downloadBtn.addEventListener("click", downloadDiff);

wireCopyButton(oldCopyBtn, () => oldEditor.value);
wireCopyButton(newCopyBtn, () => newEditor.value);
wireCopyButton(trackedCopyBtn, () => trackedEditor.value);

demoBtn.addEventListener("click", () => {
  hideError();
  setColumnContent(oldColumn, getDemoOld(), DEMO_OLD_LABEL);
  setColumnContent(newColumn, getDemoNew(), DEMO_NEW_LABEL);
  setColumnContent(trackedColumn, "", "diff.tex");
  setTrackedView("source");
  if (runner) {
    setStatus("ready", "Demo loaded — click Generate");
  }
  updateActions();
});

viewSourceBtn.addEventListener("click", () => setTrackedView("source"));
viewPreviewBtn.addEventListener("click", () => setTrackedView("preview"));

trackedEditor.addEventListener("input", () => {
  if (trackedView === "preview") {
    renderTrackedPreview();
  }
});

initTheme(themeToggle);
wirePlainPaste(editors);
wireColumn(oldColumn);
wireColumn(newColumn);
wireColumn(trackedColumn);

async function init() {
  try {
    const base = import.meta.env.BASE_URL;
    runner = new WebPerlRunner({
      webperlBasePath: `${base}core/webperl`,
      perlScriptsPath: `${base}core/perl`,
    });
    await runner.initialize();
    setStatus("ready", "Ready — paste or drop into Old and New");
    updateActions();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setStatus("error", `Failed to load WebPerl: ${msg}`);
    statusDot.setAttribute("title", msg);
  }
}

init();
