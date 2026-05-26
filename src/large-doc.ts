/** Above this: skip auto-preview after generate; preview runs async if user asks. */
export const PREVIEW_AUTO_MAX_LINES = 500;
export const PREVIEW_AUTO_MAX_CHARS = 350_000;

/** Above this: build line gutters in chunks so the UI stays responsive. */
export const LINE_GUTTER_CHUNK_LINES = 400;
export const LINE_GUTTER_CHUNK_THRESHOLD = 1_200;

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

export function isLargeForLineGutter(text: string): boolean {
  return countLines(text) > LINE_GUTTER_CHUNK_THRESHOLD;
}
