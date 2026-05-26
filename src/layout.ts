const STORAGE_KEY = "latexdiff-layout";

export type AppLayout = "stacked" | "classic";

export const MOBILE_MQ = window.matchMedia("(max-width: 900px)");

export function isMobileViewport(): boolean {
  return MOBILE_MQ.matches;
}

export function getStoredLayout(): AppLayout {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "classic" || stored === "stacked") {
    return stored;
  }
  return "stacked";
}

/** Classic on mobile; otherwise the user's saved desktop layout. */
export function getEffectiveLayout(): AppLayout {
  if (isMobileViewport()) {
    return "classic";
  }
  return getStoredLayout();
}

function applyLayoutToDom(layout: AppLayout): void {
  document.documentElement.dataset.layout = layout;
  const app = document.getElementById("app");
  if (app) {
    app.dataset.layout = layout;
  }
}

export function setStoredLayout(layout: AppLayout): void {
  localStorage.setItem(STORAGE_KEY, layout);
  applyLayoutToDom(getEffectiveLayout());
}

function updateToggle(btn: HTMLButtonElement, stored: AppLayout): void {
  const toClassic = stored === "stacked";
  btn.setAttribute(
    "aria-label",
    toClassic ? "Switch to classic three-column layout" : "Switch to stacked layout",
  );
  btn.title = toClassic ? "Classic layout (3 columns)" : "Stacked layout (default)";
}

export function syncLayoutToViewport(
  toggleBtn: HTMLButtonElement,
): AppLayout {
  const effective = getEffectiveLayout();
  applyLayoutToDom(effective);
  toggleBtn.hidden = isMobileViewport();
  if (!isMobileViewport()) {
    updateToggle(toggleBtn, getStoredLayout());
  }
  return effective;
}

export function initLayout(
  toggleBtn: HTMLButtonElement,
  onLayoutChange: (layout: AppLayout) => void,
): AppLayout {
  const stored = getStoredLayout();
  syncLayoutToViewport(toggleBtn);
  onLayoutChange(getEffectiveLayout());

  toggleBtn.addEventListener("click", () => {
    if (isMobileViewport()) return;
    const next: AppLayout = getStoredLayout() === "classic" ? "stacked" : "classic";
    setStoredLayout(next);
    applyLayoutToDom(next);
    updateToggle(toggleBtn, next);
    onLayoutChange(next);
  });

  MOBILE_MQ.addEventListener("change", () => {
    syncLayoutToViewport(toggleBtn);
    onLayoutChange(getEffectiveLayout());
  });

  return stored;
}
