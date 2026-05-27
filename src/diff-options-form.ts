import type { AppDiffOptions } from "./latexdiff-run";

export interface DiffOptionsFormElements {
  markupType: HTMLSelectElement;
  markupSubtype: HTMLSelectElement;
  floatType: HTMLSelectElement;
  mathMarkup: HTMLSelectElement;
  encoding: HTMLSelectElement;
  graphicsMarkup: HTMLSelectElement;
  flatten: HTMLInputElement;
  allowSpaces: HTMLInputElement;
  noDel: HTMLInputElement;
  disableCitationMarkup: HTMLInputElement;
  disableAutoMbox: HTMLInputElement;
  appendSafecmd: HTMLInputElement;
  excludeSafecmd: HTMLInputElement;
  appendTextcmd: HTMLInputElement;
  excludeTextcmd: HTMLInputElement;
}

/** Initial values matching index.html defaults. */
export const DEFAULT_DIFF_OPTIONS = {
  markupType: "UNDERLINE",
  markupSubtype: "",
  floatType: "FLOATSAFE",
  mathMarkup: "2",
  graphicsMarkup: "1",
  encoding: "utf8",
  flatten: false,
  allowSpaces: false,
  noDel: false,
  disableCitationMarkup: false,
  disableAutoMbox: false,
  appendSafecmd: "",
  excludeSafecmd: "",
  appendTextcmd: "",
  excludeTextcmd: "",
} as const;

export function resetDiffOptionsForm(form: DiffOptionsFormElements): void {
  const d = DEFAULT_DIFF_OPTIONS;
  form.markupType.value = d.markupType;
  form.markupSubtype.value = d.markupSubtype;
  form.floatType.value = d.floatType;
  form.mathMarkup.value = d.mathMarkup;
  form.graphicsMarkup.value = d.graphicsMarkup;
  form.encoding.value = d.encoding;
  form.flatten.checked = d.flatten;
  form.allowSpaces.checked = d.allowSpaces;
  form.noDel.checked = d.noDel;
  form.disableCitationMarkup.checked = d.disableCitationMarkup;
  form.disableAutoMbox.checked = d.disableAutoMbox;
  form.appendSafecmd.value = d.appendSafecmd;
  form.excludeSafecmd.value = d.excludeSafecmd;
  form.appendTextcmd.value = d.appendTextcmd;
  form.excludeTextcmd.value = d.excludeTextcmd;
}

export function readDiffOptionsFromForm(
  form: DiffOptionsFormElements,
): AppDiffOptions {
  const opts: AppDiffOptions = {
    type: form.markupType.value as AppDiffOptions["type"],
    floattype: form.floatType.value as AppDiffOptions["floattype"],
    encoding: form.encoding.value,
    mathMarkup: Number(form.mathMarkup.value),
    graphicsMarkup: Number(form.graphicsMarkup.value),
    flatten: form.flatten.checked,
    allowSpaces: form.allowSpaces.checked,
    noDel: form.noDel.checked,
    disableCitationMarkup: form.disableCitationMarkup.checked,
    disableAutoMbox: form.disableAutoMbox.checked,
  };

  if (form.markupSubtype.value.trim()) {
    opts.subtype = form.markupSubtype.value.trim();
  }
  if (form.appendSafecmd.value.trim()) {
    opts.appendSafecmd = form.appendSafecmd.value.trim();
  }
  if (form.excludeSafecmd.value.trim()) {
    opts.excludeSafecmd = form.excludeSafecmd.value.trim();
  }
  if (form.appendTextcmd.value.trim()) {
    opts.appendTextcmd = form.appendTextcmd.value.trim();
  }
  if (form.excludeTextcmd.value.trim()) {
    opts.excludeTextcmd = form.excludeTextcmd.value.trim();
  }

  return opts;
}
