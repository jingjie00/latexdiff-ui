const STORAGE_KEY = "latexdiff-theme";

export type Theme = "light" | "dark";

export function getStoredTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") {
    return stored;
  }
  return "light";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
}

export function initTheme(toggleBtn: HTMLButtonElement): Theme {
  const theme = getStoredTheme();
  applyTheme(theme);
  updateToggleIcon(toggleBtn, theme);

  toggleBtn.addEventListener("click", () => {
    const next: Theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
    updateToggleIcon(toggleBtn, next);
  });

  return theme;
}

function updateToggleIcon(btn: HTMLButtonElement, theme: Theme): void {
  const toDark = theme === "light";
  btn.setAttribute("aria-label", toDark ? "Switch to dark mode" : "Switch to light mode");
  btn.title = toDark ? "Dark mode" : "Light mode";
}
