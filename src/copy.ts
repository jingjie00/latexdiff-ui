const COPIED_MS = 1200;

export function wireCopyButton(
  btn: HTMLButtonElement,
  getText: () => string,
): void {
  btn.addEventListener("click", async () => {
    const text = getText();
    if (!text.trim()) return;

    try {
      await navigator.clipboard.writeText(text);
      btn.classList.add("is-copied");
      btn.title = "Copied!";
      setTimeout(() => {
        btn.classList.remove("is-copied");
        btn.title = "Copy to clipboard";
      }, COPIED_MS);
    } catch {
      btn.classList.add("is-error");
      btn.title = "Copy failed";
      setTimeout(() => {
        btn.classList.remove("is-error");
        btn.title = "Copy to clipboard";
      }, COPIED_MS);
    }
  });
}

export function setCopyEnabled(btn: HTMLButtonElement, enabled: boolean): void {
  btn.disabled = !enabled;
}
