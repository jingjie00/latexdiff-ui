/** Show a hard-refresh hint if engine bootstrap exceeds this duration. */
export const LONG_LOAD_ENGINE_MS = 15_000;

/** Show a hard-refresh hint if Generate overlay stays up this long. */
export const LONG_LOAD_GENERATE_MS = 8_000;

export function hardRefreshShortcut(): string {
  const isMac =
    /Mac|iPhone|iPad|iPod/i.test(navigator.platform) ||
    /Mac/i.test(navigator.userAgent);
  return isMac ? "⌘⇧R" : "Ctrl+Shift+R";
}

export function longLoadRefreshMessage(): string {
  return `Taking longer than usual — try a hard refresh (${hardRefreshShortcut()})`;
}

/** Arm a timer that fires once if loading stays active long enough. */
export function createLongLoadHint(
  onShow: () => void,
  onHide: () => void,
  delayMs = LONG_LOAD_ENGINE_MS,
): { arm: () => void; disarm: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let visible = false;

  return {
    arm() {
      if (timer !== null) return;
      timer = window.setTimeout(() => {
        timer = null;
        visible = true;
        onShow();
      }, delayMs);
    },
    disarm() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      if (visible) {
        visible = false;
        onHide();
      }
    },
  };
}
