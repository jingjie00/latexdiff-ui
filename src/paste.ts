/** Normalize pasted text from Word, PDF, browsers, etc. */
export function normalizePastedText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00A0/g, " ")
    .replace(/\u2028/g, "\n")
    .replace(/\u2029/g, "\n");
}

/** Prefer text/plain; fall back to stripping HTML (e.g. Word, Google Docs). */
export function extractPlainFromClipboard(cd: DataTransfer): string {
  const plain = cd.getData("text/plain");
  if (plain) {
    return normalizePastedText(plain);
  }

  const html = cd.getData("text/html");
  if (html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return normalizePastedText(doc.body.textContent ?? "");
  }

  return "";
}

export function insertTextAtSelection(textarea: HTMLTextAreaElement, text: string): void {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const before = textarea.value.slice(0, start);
  const after = textarea.value.slice(end);
  textarea.value = before + text + after;
  const pos = start + text.length;
  textarea.setSelectionRange(pos, pos);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

let lastActiveEditor: HTMLTextAreaElement | null = null;

export function wirePlainPaste(editors: HTMLTextAreaElement[]): void {
  for (const editor of editors) {
    editor.addEventListener("focus", () => {
      lastActiveEditor = editor;
    });
  }

  document.addEventListener(
    "paste",
    (e) => {
      const fromEvent =
        e.target instanceof HTMLTextAreaElement && editors.includes(e.target)
          ? e.target
          : lastActiveEditor;

      if (!fromEvent || !editors.includes(fromEvent)) {
        return;
      }

      const cd = e.clipboardData;
      if (!cd) {
        return;
      }

      const text = extractPlainFromClipboard(cd);
      if (!text) {
        return;
      }

      e.preventDefault();
      insertTextAtSelection(fromEvent, text);
    },
    true,
  );
}
