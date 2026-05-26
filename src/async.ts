/** Yield to the browser so clicks and paint stay responsive during heavy work. */
export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof scheduler !== "undefined" && "yield" in scheduler) {
      scheduler.yield().then(() => resolve());
      return;
    }
    requestAnimationFrame(() => resolve());
  });
}
