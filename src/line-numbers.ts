import { yieldToMain } from "./async";
import { countLines } from "./large-doc";

const CHUNK_LINES = 500;

function buildLineNumberText(n: number): string {
  if (n <= 0) return "1";
  const parts = new Array<string>(n);
  for (let i = 0; i < n; i++) {
    parts[i] = String(i + 1);
  }
  return parts.join("\n");
}

async function buildLineNumberTextChunked(
  n: number,
  isStale: () => boolean,
): Promise<string | null> {
  const parts: string[] = [];
  for (let start = 1; start <= n; start += CHUNK_LINES) {
    if (isStale()) return null;
    const end = Math.min(start + CHUNK_LINES - 1, n);
    const chunk = new Array<string>(end - start + 1);
    for (let i = start; i <= end; i++) {
      chunk[i - start] = String(i);
    }
    parts.push(chunk.join("\n"));
    await yieldToMain();
  }
  return parts.join("\n");
}

function activeScrollEl(scrollEls: HTMLElement[]): HTMLElement {
  for (const el of scrollEls) {
    if (el.classList.contains("hidden")) continue;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") continue;
    return el;
  }
  return scrollEls[0]!;
}

/** Sync a line-number gutter with one or more scrollable editors. Returns a manual refresh fn. */
export function wireLineNumbers(
  gutter: HTMLElement,
  getText: () => string,
  ...scrollEls: HTMLElement[]
): () => void {
  const gutterWrap = gutter.parentElement as HTMLElement;
  let refreshGen = 0;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function syncScroll(): void {
    if (scrollEls.length === 0) return;
    gutterWrap.scrollTop = activeScrollEl(scrollEls).scrollTop;
  }

  async function refreshNow(): Promise<void> {
    const gen = ++refreshGen;
    const n = countLines(getText());

    let text: string | null;
    if (n > CHUNK_LINES) {
      text = await buildLineNumberTextChunked(n, () => gen !== refreshGen);
    } else {
      text = buildLineNumberText(n);
    }

    if (gen !== refreshGen || text === null) return;

    gutter.textContent = text;
    syncScroll();
  }

  function scheduleRefresh(): void {
    if (debounceTimer !== null) {
      window.clearTimeout(debounceTimer);
    }
    debounceTimer = window.setTimeout(() => {
      debounceTimer = null;
      void refreshNow();
    }, 50);
  }

  for (const el of scrollEls) {
    el.addEventListener("scroll", syncScroll);
    el.addEventListener("input", scheduleRefresh);
  }

  const ro = new ResizeObserver(() => syncScroll());
  for (const el of scrollEls) {
    ro.observe(el);
  }

  void refreshNow();

  return () => {
    void refreshNow();
  };
}
