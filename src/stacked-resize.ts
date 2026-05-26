const STORAGE_KEY = "latexdiff-stacked-sizes";
const RESIZER_PX = 6;
const MIN_FRAC = 0.1;

export interface StackedResizeTargets {
  workspace: HTMLElement;
  workspaceBody: HTMLElement;
  editors: HTMLElement;
  sourcesStack: HTMLElement;
  oldColumn: HTMLElement;
  newColumn: HTMLElement;
  trackedColumn: HTMLElement;
  optionsPanel: HTMLElement;
}

interface StackedSizes {
  sources: number;
  tracked: number;
  options: number;
  oldRow: number;
  newRow: number;
}

const DEFAULTS: StackedSizes = {
  sources: 0.34,
  tracked: 0.66,
  options: 0.26,
  oldRow: 0.5,
  newRow: 0.5,
};

function loadSizes(): StackedSizes {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw) as Partial<StackedSizes>;
    const sizes: StackedSizes = {
      sources: num(p.sources, DEFAULTS.sources),
      tracked: num(p.tracked, DEFAULTS.tracked),
      options: num(p.options, DEFAULTS.options),
      oldRow: num(p.oldRow, DEFAULTS.oldRow),
      newRow: num(p.newRow, DEFAULTS.newRow),
    };
    normalizePair(sizes, "sources", "tracked");
    normalizePair(sizes, "oldRow", "newRow");
    return sizes;
  } catch {
    return { ...DEFAULTS };
  }
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : fallback;
}

function normalizePair(sizes: StackedSizes, a: keyof StackedSizes, b: keyof StackedSizes): void {
  const sum = sizes[a] + sizes[b];
  if (sum <= 0) return;
  sizes[a] = sizes[a] / sum;
  sizes[b] = sizes[b] / sum;
}

function saveSizes(sizes: StackedSizes): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sizes));
  } catch {
    /* ignore */
  }
}

function setPanePx(el: HTMLElement, px: number, axis: "width" | "height"): void {
  const main = axis === "width" ? "width" : "height";
  el.style.flex = `0 0 ${px}px`;
  el.style[main] = `${px}px`;
  el.style.minWidth = axis === "width" ? "0" : el.style.minWidth;
  el.style.minHeight = axis === "height" ? "0" : el.style.minHeight;
}

export function clearStackedPaneStyles(targets: StackedResizeTargets): void {
  for (const el of [
    targets.workspaceBody,
    targets.optionsPanel,
    targets.sourcesStack,
    targets.trackedColumn,
    targets.oldColumn,
    targets.newColumn,
  ]) {
    el.style.flex = "";
    el.style.width = "";
    el.style.height = "";
    el.style.minWidth = "";
    el.style.minHeight = "";
  }
}

type Orientation = "vertical" | "horizontal";

function wireResizer(
  handle: HTMLElement,
  orientation: Orientation,
  getAvail: () => number,
  onDrag: (delta: number, start: StackedSizes) => void,
  onEnd: () => void,
  getSizes: () => StackedSizes,
): void {
  handle.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    const startPos = orientation === "vertical" ? e.clientX : e.clientY;
    const startSizes = { ...getSizes() };
    handle.classList.add("is-active");
    document.body.classList.add(
      orientation === "vertical" ? "col-resizing" : "row-resizing",
    );

    const onMove = (ev: PointerEvent) => {
      const pos = orientation === "vertical" ? ev.clientX : ev.clientY;
      onDrag(pos - startPos, startSizes);
    };

    const onUp = () => {
      handle.classList.remove("is-active");
      document.body.classList.remove("col-resizing", "row-resizing");
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      onEnd();
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  });
}

function makeResizer(orientation: Orientation, label: string): HTMLElement {
  const handle = document.createElement("div");
  handle.className = orientation === "vertical" ? "col-resizer" : "row-resizer";
  handle.setAttribute("role", "separator");
  handle.setAttribute("aria-orientation", orientation === "vertical" ? "vertical" : "horizontal");
  handle.setAttribute("aria-label", label);
  handle.title = "Drag to resize";
  handle.tabIndex = 0;
  return handle;
}

/** Drag handles for stacked layout: Old/New rows, sources|tracked, editors|options. */
export function initStackedResize(targets: StackedResizeTargets): () => void {
  const {
    workspace,
    workspaceBody,
    editors,
    sourcesStack,
    oldColumn,
    newColumn,
    trackedColumn,
    optionsPanel,
  } = targets;

  let sizes = loadSizes();
  const resizers: HTMLElement[] = [];

  const rowResizer = makeResizer("horizontal", "Resize Old and New");
  wireResizer(
    rowResizer,
    "horizontal",
    () => Math.max(sourcesStack.clientHeight - RESIZER_PX, 1),
    (delta, start) => {
      const avail = Math.max(sourcesStack.clientHeight - RESIZER_PX, 1);
      const d = delta / avail;
      /* Dragging down grows the panel above the handle (Old). */
      let old = start.oldRow + d;
      let neu = start.newRow - d;
      if (old < MIN_FRAC) {
        neu -= MIN_FRAC - old;
        old = MIN_FRAC;
      }
      if (neu < MIN_FRAC) {
        old -= MIN_FRAC - neu;
        neu = MIN_FRAC;
      }
      sizes.oldRow = old;
      sizes.newRow = neu;
      normalizePair(sizes, "oldRow", "newRow");
      apply();
    },
    () => saveSizes(sizes),
    () => sizes,
  );
  rowResizer.addEventListener("dblclick", () => {
    sizes.oldRow = DEFAULTS.oldRow;
    sizes.newRow = DEFAULTS.newRow;
    saveSizes(sizes);
    apply();
  });
  newColumn.before(rowResizer);
  resizers.push(rowResizer);

  const editorsResizer = makeResizer("vertical", "Resize sources and Tracked Changes");
  wireResizer(
    editorsResizer,
    "vertical",
    () => Math.max(editors.clientWidth - RESIZER_PX, 1),
    (delta, start) => {
      const avail = Math.max(editors.clientWidth - RESIZER_PX, 1);
      const d = delta / avail;
      /* Dragging right grows the panel on the left (sources), like editors|Options. */
      let src = start.sources + d;
      let trk = start.tracked - d;
      if (src < MIN_FRAC) {
        trk -= MIN_FRAC - src;
        src = MIN_FRAC;
      }
      if (trk < MIN_FRAC) {
        src -= MIN_FRAC - trk;
        trk = MIN_FRAC;
      }
      sizes.sources = src;
      sizes.tracked = trk;
      normalizePair(sizes, "sources", "tracked");
      apply();
    },
    () => saveSizes(sizes),
    () => sizes,
  );
  editorsResizer.addEventListener("dblclick", () => {
    sizes.sources = DEFAULTS.sources;
    sizes.tracked = DEFAULTS.tracked;
    saveSizes(sizes);
    apply();
  });
  trackedColumn.before(editorsResizer);
  resizers.push(editorsResizer);

  const optionsResizer = makeResizer("vertical", "Resize editors and Options");
  wireResizer(
    optionsResizer,
    "vertical",
    () => Math.max(workspace.clientWidth - RESIZER_PX, 1),
    (delta, start) => {
      const avail = Math.max(workspace.clientWidth - RESIZER_PX, 1);
      const d = delta / avail;
      /* Dragging right grows the panel on the right (Options). */
      let opt = start.options - d;
      if (opt < MIN_FRAC) opt = MIN_FRAC;
      if (opt > 1 - MIN_FRAC) opt = 1 - MIN_FRAC;
      sizes.options = opt;
      apply();
    },
    () => saveSizes(sizes),
    () => sizes,
  );
  optionsResizer.addEventListener("dblclick", () => {
    sizes.options = DEFAULTS.options;
    saveSizes(sizes);
    apply();
  });
  optionsPanel.before(optionsResizer);
  resizers.push(optionsResizer);

  function apply(): void {
    const ws = Math.max(workspace.clientWidth - RESIZER_PX, 1);
    setPanePx(workspaceBody, Math.round(ws * (1 - sizes.options)), "width");
    setPanePx(optionsPanel, Math.round(ws * sizes.options), "width");

    const ed = Math.max(editors.clientWidth - RESIZER_PX, 1);
    setPanePx(sourcesStack, Math.round(ed * sizes.sources), "width");
    setPanePx(trackedColumn, Math.round(ed * sizes.tracked), "width");

    const sh = Math.max(sourcesStack.clientHeight - RESIZER_PX, 1);
    setPanePx(oldColumn, Math.round(sh * sizes.oldRow), "height");
    setPanePx(newColumn, Math.round(sh * sizes.newRow), "height");
  }

  const ro = new ResizeObserver(() => apply());
  ro.observe(workspace);
  ro.observe(editors);
  ro.observe(sourcesStack);

  apply();

  return () => {
    ro.disconnect();
    for (const r of resizers) r.remove();
    clearStackedPaneStyles(targets);
  };
}
