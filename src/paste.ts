/** Normalize pasted text from Word, PDF, browsers, etc. */
export function normalizePastedText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00A0/g, " ")
    .replace(/\u2028/g, "\n")
    .replace(/\u2029/g, "\n");
}

const TEXT_EXTENSIONS = new Set([
  "tex",
  "ltx",
  "latex",
  "txt",
  "md",
  "bib",
  "sty",
  "cls",
  "bst",
  "bbl",
]);

export function isTextLikeFile(file: File): boolean {
  if (file.type.startsWith("text/")) return true;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return TEXT_EXTENSIONS.has(ext);
}

/** First text-like file on the clipboard (e.g. copied from Finder). */
function getPastedFile(cd: DataTransfer): File | null {
  if (cd.files.length > 0) {
    for (const file of cd.files) {
      if (isTextLikeFile(file)) return file;
    }
  }

  for (const item of cd.items) {
    if (item.kind === "file") {
      const file = item.getAsFile();
      if (file && isTextLikeFile(file)) return file;
    }
  }

  return null;
}

/** Read clipboard: file contents first, then plain/HTML text. */
export async function extractFromClipboard(
  cd: DataTransfer,
): Promise<{ text: string; file: File | null } | null> {
  const file = getPastedFile(cd);
  if (file) {
    return { text: normalizePastedText(await file.text()), file };
  }

  const plain = cd.getData("text/plain");
  if (plain) {
    return { text: normalizePastedText(plain), file: null };
  }

  const html = cd.getData("text/html");
  if (html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return { text: normalizePastedText(doc.body.textContent ?? ""), file: null };
  }

  return null;
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

export function replaceEditorContent(textarea: HTMLTextAreaElement, text: string): void {
  textarea.value = text;
  textarea.setSelectionRange(text.length, text.length);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

let lastActiveEditor: HTMLTextAreaElement | null = null;

export function wirePlainPaste(
  editors: HTMLTextAreaElement[],
  onFilePaste?: (editor: HTMLTextAreaElement, file: File) => void,
): void {
  for (const editor of editors) {
    editor.addEventListener("focus", () => {
      lastActiveEditor = editor;
    });
  }

  document.addEventListener(
    "paste",
    async (e) => {
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

      const extracted = await extractFromClipboard(cd);
      if (!extracted) {
        return;
      }

      e.preventDefault();

      if (extracted.file) {
        replaceEditorContent(fromEvent, extracted.text);
        onFilePaste?.(fromEvent, extracted.file);
      } else {
        insertTextAtSelection(fromEvent, extracted.text);
      }
    },
    true,
  );
}
