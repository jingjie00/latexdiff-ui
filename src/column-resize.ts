const STORAGE_KEY = "latexdiff-column-widths";
const DEFAULT_WIDTHS = [0.3, 0.3, 0.4] as const;
const MIN_FRACTION = 0.12;
const RESIZER_PX = 6;

const COLUMN_LABELS = ["Old", "New", "Tracked"] as const;

function loadWidths(): number[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== 3) return null;
    const nums = parsed.map(Number);
    if (nums.some((n) => !Number.isFinite(n) || n <= 0)) return null;
    const sum = nums.reduce((a, b) => a + b, 0);
    return nums.map((n) => n / sum);
  } catch {
    return null;
  }
}

function saveWidths(widths: number[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
  } catch {
    /* quota / private mode */
  }
}

function normalize(widths: number[]): number[] {
  const sum = widths.reduce((a, b) => a + b, 0);
  return widths.map((w) => w / sum);
}

function clearColumnSizes(columns: HTMLElement[]): void {
  for (const col of columns) {
    col.style.flex = "";
    col.style.width = "";
    col.style.minWidth = "";
  }
}

/** Drag handles between Old · New · Tracked (classic layout only). */
export function initColumnResize(container: HTMLElement): () => void {
  const columns = [...container.querySelectorAll<HTMLElement>(".column")];
  if (columns.length !== 3) {
    return () => {};
  }

  let widths = loadWidths() ?? [...DEFAULT_WIDTHS];

  const resizers: HTMLElement[] = [];
  for (let i = 0; i < 2; i++) {
    const handle = document.createElement("div");
    handle.className = "col-resizer";
    handle.setAttribute("role", "separator");
    handle.setAttribute("aria-orientation", "vertical");
    handle.setAttribute("aria-valuemin", "12");
    handle.setAttribute("aria-valuemax", "88");
    handle.setAttribute(
      "aria-label",
      `Resize ${COLUMN_LABELS[i]} and ${COLUMN_LABELS[i + 1]} columns`,
    );
    handle.title = "Drag to resize columns";
    handle.tabIndex = 0;
    columns[i + 1]!.before(handle);
    resizers.push(handle);
    wireResizer(handle, i);
  }

  function contentWidth(): number {
    const resizerTotal = resizers.length * RESIZER_PX;
    return Math.max(container.clientWidth - resizerTotal, 1);
  }

  function applyWidths(): void {
    const avail = contentWidth();
    const normalized = normalize(widths);
    columns.forEach((col, i) => {
      const px = Math.round(avail * normalized[i]!);
      col.style.flex = `0 0 ${px}px`;
      col.style.width = `${px}px`;
      col.style.minWidth = "0";
    });
    resizers.forEach((r, i) => {
      const pct = Math.round(normalized[i]! * 100);
      r.setAttribute("aria-valuenow", String(pct));
    });
  }

  function wireResizer(handle: HTMLElement, index: number): void {
    const startDrag = (clientX: number) => {
      const startX = clientX;
      const startWidths = [...widths];
      const avail = contentWidth();
      handle.classList.add("is-active");
      document.body.classList.add("col-resizing");

      const onMove = (x: number) => {
        const deltaFrac = (x - startX) / avail;
        let left = startWidths[index]! + deltaFrac;
        let right = startWidths[index + 1]! - deltaFrac;

        if (left < MIN_FRACTION) {
          right -= MIN_FRACTION - left;
          left = MIN_FRACTION;
        }
        if (right < MIN_FRACTION) {
          left -= MIN_FRACTION - right;
          right = MIN_FRACTION;
        }

        widths = [...startWidths];
        widths[index] = left;
        widths[index + 1] = right;
        applyWidths();
      };

      const onPointerMove = (ev: PointerEvent) => onMove(ev.clientX);
      const onPointerUp = () => {
        handle.classList.remove("is-active");
        document.body.classList.remove("col-resizing");
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerup", onPointerUp);
        document.removeEventListener("pointercancel", onPointerUp);
        widths = normalize(widths);
        saveWidths(widths);
      };

      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
      document.addEventListener("pointercancel", onPointerUp);
    };

    handle.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      startDrag(e.clientX);
    });

    handle.addEventListener("dblclick", () => {
      widths = [...DEFAULT_WIDTHS];
      saveWidths(widths);
      applyWidths();
    });

    handle.addEventListener("keydown", (e) => {
      const step = 0.02;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        widths[index] = Math.max(MIN_FRACTION, widths[index]! - step);
        widths[index + 1] = Math.min(1 - MIN_FRACTION, widths[index + 1]! + step);
        widths = normalize(widths);
        applyWidths();
        saveWidths(widths);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        widths[index] = Math.min(1 - MIN_FRACTION, widths[index]! + step);
        widths[index + 1] = Math.max(MIN_FRACTION, widths[index + 1]! - step);
        widths = normalize(widths);
        applyWidths();
        saveWidths(widths);
      } else if (e.key === "Home") {
        e.preventDefault();
        widths = [...DEFAULT_WIDTHS];
        saveWidths(widths);
        applyWidths();
      }
    });
  }

  const ro = new ResizeObserver(() => applyWidths());
  ro.observe(container);

  applyWidths();

  return () => {
    ro.disconnect();
    for (const r of resizers) {
      r.remove();
    }
    clearColumnSizes(columns);
  };
}
