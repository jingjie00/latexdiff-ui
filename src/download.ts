export function filenameFromHint(hint: HTMLElement, fallback: string): string {
  const raw = hint.textContent?.trim();
  if (!raw) return fallback;
  const base = raw.split(/[\s(]/)[0];
  if (!base) return fallback;
  return base.includes(".") ? base : `${base}.tex`;
}

export function downloadText(text: string, filename: string): void {
  if (!text.trim()) return;

  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function wireDownloadButton(
  btn: HTMLButtonElement,
  getText: () => string,
  getFilename: () => string,
): void {
  btn.addEventListener("click", () => {
    downloadText(getText(), getFilename());
  });
}

export function setDownloadEnabled(btn: HTMLButtonElement, enabled: boolean): void {
  btn.disabled = !enabled;
}
