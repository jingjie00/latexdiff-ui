function countLines(text: string): number {
  if (!text) return 1;
  let n = 1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") n++;
  }
  return n;
}

/** Sync a line-number gutter with one or more scrollable editors. */
export function wireLineNumbers(
  gutter: HTMLElement,
  getText: () => string,
  ...scrollEls: HTMLElement[]
): () => void {
  const gutterWrap = gutter.parentElement as HTMLElement;

  function refresh() {
    const n = countLines(getText());
    gutter.textContent = Array.from({ length: n }, (_, i) => String(i + 1)).join("\n");
  }

  for (const el of scrollEls) {
    el.addEventListener("scroll", () => {
      gutterWrap.scrollTop = el.scrollTop;
    });
    el.addEventListener("input", refresh);
  }

  refresh();
  return refresh;
}
