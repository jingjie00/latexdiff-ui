/** Escape text for safe HTML insertion. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Read a LaTeX brace group starting at `{`. */
function readBraceGroup(
  source: string,
  openIdx: number,
): { content: string; endIdx: number } | null {
  if (source[openIdx] !== "{") return null;

  let depth = 1;
  let i = openIdx + 1;
  const start = i;

  while (i < source.length) {
    const ch = source[i];
    if (ch === "\\") {
      i += Math.min(2, source.length - i);
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return { content: source.slice(start, i), endIdx: i + 1 };
      }
    }
    i++;
  }
  return null;
}

const SKIP_DIF_KEYWORDS = [
  "\\DIFaddbegin",
  "\\DIFaddend",
  "\\DIFdelbegin",
  "\\DIFdelend",
  "\\DIFmodbegin",
  "\\DIFmodend",
] as const;

export const PREVIEW_RENDER_MAX_CHARS = 250_000;

/**
 * Color \\DIFadd / \\DIFdel in browser — no Perl, single pass, one HTML string.
 */
export function buildPreviewHtml(source: string): { html: string; truncated: boolean } {
  const truncated = source.length > PREVIEW_RENDER_MAX_CHARS;
  const text = truncated ? source.slice(0, PREVIEW_RENDER_MAX_CHARS) : source;
  const parts: string[] = [];
  let i = 0;

  while (i < text.length) {
    let skipped = false;
    for (const kw of SKIP_DIF_KEYWORDS) {
      if (text.startsWith(kw, i)) {
        i += kw.length;
        skipped = true;
        break;
      }
    }
    if (skipped) continue;

    if (text.startsWith("\\DIFadd{", i)) {
      const group = readBraceGroup(text, i + 7);
      if (group) {
        parts.push(`<span class="dif-add" title="added">${escapeHtml(group.content)}</span>`);
        i = group.endIdx;
        continue;
      }
      i += 8;
      continue;
    }

    if (text.startsWith("\\DIFdel{", i)) {
      const group = readBraceGroup(text, i + 7);
      if (group) {
        parts.push(`<span class="dif-del" title="deleted">${escapeHtml(group.content)}</span>`);
        i = group.endIdx;
        continue;
      }
      i += 8;
      continue;
    }

    if (text.startsWith("%DIF", i)) {
      const lineEnd = text.indexOf("\n", i);
      const end = lineEnd === -1 ? text.length : lineEnd + 1;
      parts.push(`<span class="dif-preamble">${escapeHtml(text.slice(i, end))}</span>`);
      i = end;
      continue;
    }

    const nextDif = text.indexOf("\\DIF", i);
    const nextPre = text.indexOf("%DIF", i);
    let end = text.length;
    if (nextDif !== -1) end = Math.min(end, nextDif);
    if (nextPre !== -1) end = Math.min(end, nextPre);
    if (end <= i) {
      i += 1;
      continue;
    }
    parts.push(escapeHtml(text.slice(i, end)));
    i = end;
  }

  return { html: parts.join(""), truncated };
}

export function setPreviewMessage(
  container: HTMLElement,
  className: "preview-empty" | "preview-loading",
  message: string,
): void {
  container.replaceChildren();
  const span = document.createElement("span");
  span.className = className;
  span.textContent = message;
  container.appendChild(span);
}
