import { LINE_GUTTER_CHUNK_LINES, countLines, isLargeForLineGutter } from "./large-doc";
import { yieldToMain } from "./async";

function buildLineNumberText(n: number): string {
  if (n <= 0) return "1";
  const parts = new Array<string>(n);
  for (let i = 0; i < n; i++) {
    parts[i] = String(i + 1);
  }
  return parts.join("\n");
}

async function buildLineNumberTextChunked(n: number): Promise<string> {
  const parts: string[] = [];
  for (let start = 1; start <= n; start += LINE_GUTTER_CHUNK_LINES) {
    const end = Math.min(start + LINE_GUTTER_CHUNK_LINES - 1, n);
    const chunk: string[] = [];
    for (let i = start; i <= end; i++) {
      chunk.push(String(i));
    }
    parts.push(chunk.join("\n"));
    await yieldToMain();
  }
  return parts.join("\n");
}

/** Sync a line-number gutter with one or more scrollable editors. */
export function wireLineNumbers(
  gutter: HTMLElement,
  getText: () => string,
  ...scrollEls: HTMLElement[]
): () => void {
  const gutterWrap = gutter.parentElement as HTMLElement;
  let refreshGen = 0;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  async function refreshNow() {
    const gen = ++refreshGen;
    const n = countLines(getText());

    if (isLargeForLineGutter(getText())) {
      gutter.textContent = "…";
      const text = await buildLineNumberTextChunked(n);
      if (gen !== refreshGen) return;
      gutter.textContent = text;
      return;
    }

    gutter.textContent = buildLineNumberText(n);
  }

  function scheduleRefresh() {
    if (debounceTimer !== null) {
      window.clearTimeout(debounceTimer);
    }
    debounceTimer = window.setTimeout(() => {
      debounceTimer = null;
      void refreshNow();
    }, 80);
  }

  for (const el of scrollEls) {
    el.addEventListener("scroll", () => {
      gutterWrap.scrollTop = el.scrollTop;
    });
    el.addEventListener("input", scheduleRefresh);
  }

  void refreshNow();
  return () => {
    if (debounceTimer !== null) {
      window.clearTimeout(debounceTimer);
    }
    void refreshNow();
  };
}
