const STORAGE_KEY = "latexdiff-editor-wrap";

let wrapEnabled = loadWrap();
const listeners = new Set<() => void>();

function loadWrap(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "0") return false;
    if (v === "1") return true;
  } catch {
    /* ignore */
  }
  return true;
}

function saveWrap(): void {
  try {
    localStorage.setItem(STORAGE_KEY, wrapEnabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function isEditorWrapEnabled(): boolean {
  return wrapEnabled;
}

export function onEditorWrapChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function notifyWrapChange(): void {
  for (const cb of listeners) {
    cb();
  }
}

export function applyEditorWrap(textareas: readonly HTMLTextAreaElement[]): void {
  for (const ta of textareas) {
    ta.wrap = wrapEnabled ? "soft" : "off";
    ta.classList.toggle("is-wrap", wrapEnabled);
  }
}

export function setEditorWrapEnabled(on: boolean): void {
  if (wrapEnabled === on) return;
  wrapEnabled = on;
  saveWrap();
  notifyWrapChange();
}

export function toggleEditorWrap(): void {
  setEditorWrapEnabled(!wrapEnabled);
}

function syncWrapToggleButtons(buttons: readonly HTMLButtonElement[]): void {
  const label = wrapEnabled ? "Word wrap on" : "Word wrap off";
  for (const btn of buttons) {
    btn.classList.toggle("is-active", wrapEnabled);
    btn.setAttribute("aria-pressed", String(wrapEnabled));
    btn.title = label;
    btn.setAttribute("aria-label", label);
  }
}

export function wireWrapToggles(
  textareas: readonly HTMLTextAreaElement[],
  buttons: readonly HTMLButtonElement[],
): void {
  applyEditorWrap(textareas);
  syncWrapToggleButtons(buttons);

  for (const btn of buttons) {
    btn.addEventListener("click", () => {
      toggleEditorWrap();
    });
  }

  onEditorWrapChange(() => {
    applyEditorWrap(textareas);
    syncWrapToggleButtons(buttons);
  });
}
