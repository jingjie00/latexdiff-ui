/** Stamp footer with the time this bundle was built (matches deploy from CI push). */
export function initBuildTime(el: HTMLElement): void {
  const iso = typeof __BUILD_TIME__ === "string" ? __BUILD_TIME__ : "";
  if (!iso) return;

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return;

  const gmt = date.toLocaleString("en-GB", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  el.textContent = ` · Built ${gmt} GMT`;
  el.title = `Build time (GMT): ${gmt}`;
  el.hidden = false;
}
