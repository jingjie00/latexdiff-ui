import { normalizePastedText } from "./paste";

export interface ColumnSetup {
  wrap: HTMLElement;
  textarea: HTMLTextAreaElement;
  hint: HTMLElement;
  onChange?: () => void;
}

/** Read text from a dropped file or plain-text drag payload. */
export async function readDropData(dt: DataTransfer): Promise<string | null> {
  const file = dt.files?.[0];
  if (file) {
    return normalizePastedText(await file.text());
  }

  const plain = dt.getData("text/plain");
  if (plain) {
    return normalizePastedText(plain);
  }

  const html = dt.getData("text/html");
  if (html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return normalizePastedText(doc.body.textContent ?? "");
  }

  return null;
}

export function setColumnContent(
  setup: ColumnSetup,
  content: string,
  sourceLabel?: string,
) {
  setup.textarea.value = content;
  if (sourceLabel !== undefined) {
    setup.hint.textContent = sourceLabel;
    setup.hint.title = sourceLabel;
  }
  setup.onChange?.();
}

export function wireColumn(setup: ColumnSetup): void {
  const { wrap, textarea } = setup;

  textarea.addEventListener("input", () => {
    if (setup.hint.dataset.fromFile) {
      setup.hint.textContent = setup.hint.dataset.defaultName ?? "";
      delete setup.hint.dataset.fromFile;
    }
    setup.onChange?.();
  });

  wrap.addEventListener("dragenter", (e) => {
    e.preventDefault();
    wrap.classList.add("drag-over");
  });

  wrap.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }
    wrap.classList.add("drag-over");
  });

  wrap.addEventListener("dragleave", (e) => {
    if (!wrap.contains(e.relatedTarget as Node)) {
      wrap.classList.remove("drag-over");
    }
  });

  wrap.addEventListener("drop", async (e) => {
    e.preventDefault();
    wrap.classList.remove("drag-over");

    const dt = e.dataTransfer;
    if (!dt) return;

    const text = await readDropData(dt);
    if (text === null) {
      return;
    }

    const file = dt.files?.[0];
    const label = file?.name ?? "dropped text";
    setup.hint.dataset.fromFile = "1";
    setup.hint.dataset.defaultName = setup.hint.textContent;
    setColumnContent(setup, text, label);
    textarea.focus();
  });
}
