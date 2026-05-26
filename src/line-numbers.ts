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

const mirrorByTextarea = new WeakMap<HTMLTextAreaElement, HTMLDivElement>();

function getMeasureMirror(textarea: HTMLTextAreaElement): HTMLDivElement {
  let mirror = mirrorByTextarea.get(textarea);
  if (mirror) return mirror;

  mirror = document.createElement("div");
  mirror.className = "editor-measure";
  mirror.setAttribute("aria-hidden", "true");
  textarea.parentElement?.appendChild(mirror);
  mirrorByTextarea.set(textarea, mirror);
  return mirror;
}

function contentWidth(textarea: HTMLTextAreaElement): number {
  const cs = getComputedStyle(textarea);
  const pl = parseFloat(cs.paddingLeft) || 0;
  const pr = parseFloat(cs.paddingRight) || 0;
  return Math.max(textarea.clientWidth - pl - pr, 1);
}

function syncMirrorStyle(textarea: HTMLTextAreaElement, mirror: HTMLDivElement): void {
  const cs = getComputedStyle(textarea);
  mirror.style.fontFamily = cs.fontFamily;
  mirror.style.fontSize = cs.fontSize;
  mirror.style.lineHeight = cs.lineHeight;
  mirror.style.tabSize = cs.tabSize;
  mirror.style.letterSpacing = cs.letterSpacing;
  mirror.style.width = `${contentWidth(textarea)}px`;
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordBreak = "break-word";
  mirror.style.overflowWrap = "break-word";
}

function singleLineHeight(textarea: HTMLTextAreaElement): number {
  const cs = getComputedStyle(textarea);
  let lh = parseFloat(cs.lineHeight);
  if (!Number.isFinite(lh) || lh <= 0) {
    const fs = parseFloat(cs.fontSize);
    lh = Number.isFinite(fs) ? fs * 1.45 : 18;
  }
  return lh;
}

async function measureWrappedLineHeights(
  textarea: HTMLTextAreaElement,
  text: string,
  isStale: () => boolean,
): Promise<number[] | null> {
  const mirror = getMeasureMirror(textarea);
  syncMirrorStyle(textarea, mirror);

  const lines = text.length ? text.split("\n") : [""];
  const heights: number[] = new Array(lines.length);

  for (let i = 0; i < lines.length; i++) {
    if (isStale()) return null;
    mirror.textContent = lines[i]!.length > 0 ? lines[i]! : " ";
    heights[i] = mirror.offsetHeight;
    if (i > 0 && i % CHUNK_LINES === 0) {
      await yieldToMain();
    }
  }

  return heights;
}

function renderFlatGutter(gutter: HTMLElement, text: string): void {
  gutter.classList.remove("is-wrapped");
  gutter.replaceChildren();
  gutter.textContent = text;
}

function renderWrappedGutter(gutter: HTMLElement, heights: number[]): void {
  gutter.classList.add("is-wrapped");
  gutter.replaceChildren();
  const frag = document.createDocumentFragment();
  for (let i = 0; i < heights.length; i++) {
    const row = document.createElement("div");
    row.className = "line-number-row";
    row.style.height = `${heights[i]!}px`;
    row.textContent = String(i + 1);
    frag.appendChild(row);
  }
  gutter.appendChild(frag);
}

/** Sync a line-number gutter with one or more scrollable editors. Returns a manual refresh fn. */
export function wireLineNumbers(
  gutter: HTMLElement,
  getText: () => string,
  measureEl: HTMLTextAreaElement,
  getWrap: () => boolean,
  ...scrollEls: HTMLElement[]
): () => void {
  const gutterWrap = gutter.parentElement as HTMLElement;
  const allScrollEls = scrollEls.length > 0 ? scrollEls : [measureEl];
  let refreshGen = 0;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function syncScroll(): void {
    gutterWrap.scrollTop = activeScrollEl(allScrollEls).scrollTop;
  }

  async function refreshNow(): Promise<void> {
    const gen = ++refreshGen;
    const text = getText();
    const n = countLines(text);
    const wrap = getWrap();

    if (!wrap) {
      let flat: string | null;
      if (n > CHUNK_LINES) {
        flat = await buildLineNumberTextChunked(n, () => gen !== refreshGen);
      } else {
        flat = buildLineNumberText(n);
      }
      if (gen !== refreshGen || flat === null) return;
      renderFlatGutter(gutter, flat);
      syncScroll();
      return;
    }

    const heights = await measureWrappedLineHeights(measureEl, text, () => gen !== refreshGen);
    if (gen !== refreshGen || heights === null) return;

    if (heights.length === 0) {
      renderWrappedGutter(gutter, [singleLineHeight(measureEl)]);
    } else {
      renderWrappedGutter(gutter, heights);
    }
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

  for (const el of allScrollEls) {
    el.addEventListener("scroll", syncScroll);
    el.addEventListener("input", scheduleRefresh);
  }

  const ro = new ResizeObserver(() => {
    if (getWrap()) {
      scheduleRefresh();
    } else {
      syncScroll();
    }
  });
  ro.observe(measureEl);

  void refreshNow();

  return () => {
    void refreshNow();
  };
}
