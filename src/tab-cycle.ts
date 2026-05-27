export interface WorkflowTabCycle {
  syncTrackedTabIndex(isPreview: boolean): void;
}

/** Old → New → Generate → Tracked → Old (keyboard Tab cycle). */
export function wireWorkflowTabCycle(
  oldEditor: HTMLTextAreaElement,
  newEditor: HTMLTextAreaElement,
  generateBtn: HTMLButtonElement,
  trackedEditor: HTMLTextAreaElement,
  trackedPreview: HTMLElement,
  getIsPreview: () => boolean,
): WorkflowTabCycle {
  const getTrackedFocusEl = (): HTMLElement =>
    getIsPreview() ? trackedPreview : trackedEditor;

  const syncTrackedTabIndex = (isPreview: boolean): void => {
    trackedEditor.tabIndex = isPreview ? -1 : 4;
    trackedPreview.tabIndex = isPreview ? 4 : -1;
  };

  const handleKeydown = (e: KeyboardEvent): void => {
    if (e.key !== "Tab") {
      return;
    }

    const ring: HTMLElement[] = [
      oldEditor,
      newEditor,
      generateBtn,
      getTrackedFocusEl(),
    ];
    const current = e.currentTarget as HTMLElement;
    const idx = ring.indexOf(current);
    if (idx === -1) {
      return;
    }

    if (!e.shiftKey && idx === ring.length - 1) {
      e.preventDefault();
      oldEditor.focus();
    } else if (e.shiftKey && idx === 0) {
      e.preventDefault();
      getTrackedFocusEl().focus();
    }
  };

  for (const el of [oldEditor, newEditor, generateBtn, trackedEditor, trackedPreview]) {
    el.addEventListener("keydown", handleKeydown);
  }

  syncTrackedTabIndex(getIsPreview());

  return { syncTrackedTabIndex };
}
