/** Above this: skip auto-preview after generate; preview runs async if user asks. */
export const PREVIEW_AUTO_MAX_LINES = 500;
export const PREVIEW_AUTO_MAX_CHARS = 350_000;

export function countLines(text: string): number {
  if (!text) return 1;
  let n = 1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") n++;
  }
  return n;
}

export function isLargeForPreview(text: string): boolean {
  return (
    text.length > PREVIEW_AUTO_MAX_CHARS || countLines(text) > PREVIEW_AUTO_MAX_LINES
  );
}
