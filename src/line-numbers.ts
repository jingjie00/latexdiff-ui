import { countLines } from "./large-doc";

const VIEWPORT_BUFFER_LINES = 40;

interface GutterMetrics {
  lineHeight: number;
  padTop: number;
  padBottom: number;
}

function measureGutterMetrics(scrollEl: HTMLElement): GutterMetrics {
  const cs = getComputedStyle(scrollEl);
  const fontSize = parseFloat(cs.fontSize);
  let lineHeight = parseFloat(cs.lineHeight);
  if (!Number.isFinite(lineHeight)) {
    lineHeight = Number.isFinite(fontSize) ? fontSize * 1.45 : 18;
  }
  return {
    lineHeight,
    padTop: parseFloat(cs.paddingTop) || 0,
    padBottom: parseFloat(cs.paddingBottom) || 0,
  };
}

function fullGutterHeight(metrics: GutterMetrics, totalLines: number): number {
  return metrics.padTop + metrics.padBottom + totalLines * metrics.lineHeight;
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

function buildLineRange(start: number, end: number): string {
  if (end < start) return "1";
  const count = end - start + 1;
  const parts = new Array<string>(count);
  for (let i = 0; i < count; i++) {
    parts[i] = String(start + i);
  }
  return parts.join("\n");
}

function visibleLineRange(
  metrics: GutterMetrics,
  totalLines: number,
  scrollTop: number,
  clientHeight: number,
): { start: number; end: number } {
  if (totalLines <= 0) {
    return { start: 1, end: 1 };
  }

  const firstVisible = Math.max(
    1,
    Math.floor((scrollTop - metrics.padTop) / metrics.lineHeight) + 1,
  );
  const lastVisible = Math.min(
    totalLines,
    Math.ceil((scrollTop + clientHeight - metrics.padTop) / metrics.lineHeight) + 1,
  );

  return {
    start: Math.max(1, firstVisible - VIEWPORT_BUFFER_LINES),
    end: Math.min(totalLines, lastVisible + VIEWPORT_BUFFER_LINES),
  };
}

/** Sync a line-number gutter with one or more scrollable editors. */
export function wireLineNumbers(
  gutter: HTMLElement,
  getText: () => string,
  ...scrollEls: HTMLElement[]
): () => void {
  const gutterWrap = gutter.parentElement as HTMLElement;
  let totalLines = 1;
  let refreshGen = 0;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let rafId = 0;

  function renderVisible(forceMetrics = false): void {
    if (scrollEls.length === 0) return;

    const scrollEl = activeScrollEl(scrollEls);
    const metrics = measureGutterMetrics(scrollEl);
    const range = visibleLineRange(
      metrics,
      totalLines,
      scrollEl.scrollTop,
      scrollEl.clientHeight,
    );

    gutter.style.boxSizing = "border-box";
    gutter.style.minHeight = `${fullGutterHeight(metrics, totalLines)}px`;
    gutter.style.paddingTop = `${metrics.padTop + (range.start - 1) * metrics.lineHeight}px`;
    gutter.style.paddingBottom = `${metrics.padBottom}px`;
    gutter.textContent = buildLineRange(range.start, range.end);

    if (forceMetrics) {
      gutterWrap.scrollTop = scrollEl.scrollTop;
    }
  }

  function scheduleRender(forceMetrics = false): void {
    if (rafId) {
      cancelAnimationFrame(rafId);
    }
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      renderVisible(forceMetrics);
    });
  }

  async function refreshLineCount(): Promise<void> {
    const gen = ++refreshGen;
    totalLines = countLines(getText());
    if (gen !== refreshGen) return;
    scheduleRender(true);
  }

  function scheduleRefresh(): void {
    if (debounceTimer !== null) {
      window.clearTimeout(debounceTimer);
    }
    debounceTimer = window.setTimeout(() => {
      debounceTimer = null;
      void refreshLineCount();
    }, 80);
  }

  for (const el of scrollEls) {
    el.addEventListener("scroll", () => {
      gutterWrap.scrollTop = el.scrollTop;
      scheduleRender();
    });
    el.addEventListener("input", scheduleRefresh);
  }

  const ro = new ResizeObserver(() => scheduleRender(true));
  for (const el of scrollEls) {
    ro.observe(el);
  }

  void refreshLineCount();

  return () => {
    ro.disconnect();
    if (debounceTimer !== null) {
      window.clearTimeout(debounceTimer);
    }
    if (rafId) {
      cancelAnimationFrame(rafId);
    }
    gutter.style.minHeight = "";
    gutter.style.paddingTop = "";
    gutter.style.paddingBottom = "";
  };
}
