import { yieldToMain } from "./async";

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
      i += 2;
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

const DIF_CMD =
  /^\\DIF(add|del|mod)(begin|end|FL)?(\{)?/;

/**
 * Turn latexdiff source into HTML with deletion/addition highlighting.
 * PDF compile in-browser would need a full TeX engine (very heavy); this is instant.
 */
export function highlightLatexDiff(source: string): string {
  let i = 0;
  let out = "";

  while (i < source.length) {
    // Preamble / metadata comment lines
    if (source.startsWith("%DIF", i)) {
      const lineEnd = source.indexOf("\n", i);
      const end = lineEnd === -1 ? source.length : lineEnd + 1;
      out += `<span class="dif-preamble">${escapeHtml(source.slice(i, end))}</span>`;
      i = end;
      continue;
    }

    const rest = source.slice(i);
    const cmd = rest.match(DIF_CMD);
    if (cmd) {
      const kind = cmd[1];
      const variant = cmd[2] ?? "";
      const hasBrace = cmd[3] === "{";

      i += cmd[0].length;

      if (hasBrace && (kind === "add" || kind === "del")) {
        const group = readBraceGroup(source, i - 1);
        if (group) {
          const inner = highlightLatexDiff(group.content);
          const cls = kind === "add" ? "dif-add" : "dif-del";
          const label = kind === "add" ? "added" : "deleted";
          out += `<span class="${cls}" title="${label}">${inner}</span>`;
          i = group.endIdx;
          continue;
        }
      }

      if (variant === "begin" || variant === "end") {
        const cls =
          kind === "add"
            ? "dif-marker dif-marker-add"
            : kind === "del"
              ? "dif-marker dif-marker-del"
              : "dif-marker";
        out += `<span class="${cls}" title="${escapeHtml(cmd[0])}"></span>`;
        continue;
      }

      out += escapeHtml(cmd[0]);
      continue;
    }

    const nextSpecial = source.indexOf("\\DIF", i);
    const nextPreamble = source.indexOf("%DIF", i);
    let end = source.length;
    if (nextSpecial !== -1) end = Math.min(end, nextSpecial);
    if (nextPreamble !== -1) end = Math.min(end, nextPreamble);

    out += escapeHtml(source.slice(i, end));
    i = end;
  }

  return out;
}

const YIELD_EVERY_CHARS = 8_000;

/**
 * Same output as highlightLatexDiff but yields so the tab stays responsive on large diffs.
 */
export async function highlightLatexDiffAsync(
  source: string,
  onProgress?: (percent: number) => void,
): Promise<string> {
  let i = 0;
  let out = "";
  const total = Math.max(source.length, 1);
  let sinceYield = 0;

  while (i < source.length) {
    if (source.startsWith("%DIF", i)) {
      const lineEnd = source.indexOf("\n", i);
      const end = lineEnd === -1 ? source.length : lineEnd + 1;
      out += `<span class="dif-preamble">${escapeHtml(source.slice(i, end))}</span>`;
      i = end;
      sinceYield += end;
    } else {
      const rest = source.slice(i);
      const cmd = rest.match(DIF_CMD);
      if (cmd) {
        const kind = cmd[1];
        const variant = cmd[2] ?? "";
        const hasBrace = cmd[3] === "{";

        i += cmd[0].length;
        sinceYield += cmd[0].length;

        if (hasBrace && (kind === "add" || kind === "del")) {
          const group = readBraceGroup(source, i - 1);
          if (group) {
            const inner =
              group.content.length > 8_000
                ? escapeHtml(group.content)
                : highlightLatexDiff(group.content);
            const cls = kind === "add" ? "dif-add" : "dif-del";
            const label = kind === "add" ? "added" : "deleted";
            out += `<span class="${cls}" title="${label}">${inner}</span>`;
            i = group.endIdx;
            sinceYield += group.content.length;
          } else {
            out += escapeHtml(cmd[0]);
          }
          continue;
        }

        if (variant === "begin" || variant === "end") {
          const cls =
            kind === "add"
              ? "dif-marker dif-marker-add"
              : kind === "del"
                ? "dif-marker dif-marker-del"
                : "dif-marker";
          out += `<span class="${cls}" title="${escapeHtml(cmd[0])}"></span>`;
          continue;
        }

        out += escapeHtml(cmd[0]);
        continue;
      }

      const nextSpecial = source.indexOf("\\DIF", i);
      const nextPreamble = source.indexOf("%DIF", i);
      let end = source.length;
      if (nextSpecial !== -1) end = Math.min(end, nextSpecial);
      if (nextPreamble !== -1) end = Math.min(end, nextPreamble);

      const slice = source.slice(i, end);
      out += escapeHtml(slice);
      sinceYield += slice.length;
      i = end;
    }

    onProgress?.(Math.min(99, Math.round((i / total) * 100)));

    if (sinceYield >= YIELD_EVERY_CHARS) {
      sinceYield = 0;
      await yieldToMain();
    }
  }

  onProgress?.(100);
  return out;
}
