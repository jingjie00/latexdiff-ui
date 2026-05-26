export interface PopoverElements {
  wrap: HTMLElement;
  toggleBtn: HTMLButtonElement;
  popover: HTMLElement;
}

/** Register popovers that close each other when a different one is opened. */
export function initLinkedPopovers(popovers: PopoverElements[]): void {
  const items = popovers.map(({ wrap, toggleBtn, popover }) => {
    function setOpen(open: boolean) {
      toggleBtn.setAttribute("aria-expanded", String(open));
      popover.hidden = !open;
      if (open) {
        popover.focus();
      }
    }

    function isOpen(): boolean {
      return toggleBtn.getAttribute("aria-expanded") === "true";
    }

    return { wrap, toggleBtn, popover, setOpen, isOpen };
  });

  for (const item of items) {
    item.toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const opening = !item.isOpen();
      for (const other of items) {
        other.setOpen(false);
      }
      item.setOpen(opening);
    });

    document.addEventListener("click", (e) => {
      if (!item.isOpen()) return;
      const target = e.target as Node;
      if (!item.wrap.contains(target)) {
        item.setOpen(false);
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && item.isOpen()) {
        item.setOpen(false);
        item.toggleBtn.focus();
      }
    });
  }
}
