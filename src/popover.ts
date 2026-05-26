export function initPopover(
  wrap: HTMLElement,
  toggleBtn: HTMLButtonElement,
  popover: HTMLElement,
): void {
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

  toggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setOpen(!isOpen());
  });

  document.addEventListener("click", (e) => {
    if (!isOpen()) return;
    const target = e.target as Node;
    if (!wrap.contains(target)) {
      setOpen(false);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) {
      setOpen(false);
      toggleBtn.focus();
    }
  });
}
