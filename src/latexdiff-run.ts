import type { LatexDiffOptions, ScriptResult, WebPerlRunner } from "wasm-latex-tools";

/** UI + CLI options passed to latexdiff (includes flags beyond wasm-latex-tools wrapper). */
export interface AppDiffOptions {
  type: NonNullable<LatexDiffOptions["type"]>;
  subtype?: string;
  floattype: NonNullable<LatexDiffOptions["floattype"]>;
  encoding: string;
  mathMarkup: number;
  flatten: boolean;
  allowSpaces: boolean;
  excludeSafecmd?: string;
  appendSafecmd?: string;
  excludeTextcmd?: string;
  appendTextcmd?: string;
  graphicsMarkup?: number;
  noDel?: boolean;
  disableCitationMarkup?: boolean;
  disableAutoMbox?: boolean;
}

type VfsFile = { fn: string; text: string };

let scriptCache: VfsFile[] | null = null;
let scriptCacheKey = "";

async function loadLatexdiffScripts(runner: WebPerlRunner): Promise<VfsFile[]> {
  const config = runner.getConfig();
  const key = config.perlScriptsPath;
  if (scriptCache && scriptCacheKey === key) {
    return scriptCache;
  }
  const url = `${key}/latexdiff.pl`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Failed to load latexdiff (${resp.status})`);
  }
  scriptCache = [{ fn: "/latexdiff.pl", text: await resp.text() }];
  scriptCacheKey = key;
  return scriptCache;
}

function pushIf(args: string[], flag: string, value?: string): void {
  if (value?.trim()) {
    args.push(`${flag}=${value.trim()}`);
  }
}

export function buildLatexdiffCliArgs(
  oldPath: string,
  newPath: string,
  options: AppDiffOptions,
): string[] {
  const args = ["/latexdiff.pl"];

  args.push(`--type=${options.type}`);
  if (options.subtype?.trim()) {
    args.push(`--subtype=${options.subtype.trim()}`);
  }
  args.push(`--floattype=${options.floattype}`);
  args.push(`--encoding=${options.encoding}`);
  pushIf(args, "--exclude-safecmd", options.excludeSafecmd);
  pushIf(args, "--append-safecmd", options.appendSafecmd);
  pushIf(args, "--exclude-textcmd", options.excludeTextcmd);
  pushIf(args, "--append-textcmd", options.appendTextcmd);
  args.push(`--math-markup=${options.mathMarkup}`);
  if (options.graphicsMarkup !== undefined && options.graphicsMarkup >= 0) {
    args.push(`--graphics-markup=${options.graphicsMarkup}`);
  }
  if (options.allowSpaces) args.push("--allow-spaces");
  if (options.flatten) args.push("--flatten");
  if (options.noDel) args.push("--no-del");
  if (options.disableCitationMarkup) args.push("--disable-citation-markup");
  if (options.disableAutoMbox) args.push("--disable-auto-mbox");

  args.push(oldPath, newPath);
  return args;
}

export async function runLatexdiff(
  runner: WebPerlRunner,
  oldContent: string,
  newContent: string,
  options: AppDiffOptions,
): Promise<ScriptResult> {
  const scripts = await loadLatexdiffScripts(runner);
  const t = Date.now();
  const oldPath = `/tmp/old_${t}.tex`;
  const newPath = `/tmp/new_${t}.tex`;
  const outputPath = `/tmp/diff_${t}.tex`;
  const args = buildLatexdiffCliArgs(oldPath, newPath, options);

  return runner.runScript(
    args,
    [
      ...scripts,
      { fn: oldPath, text: oldContent },
      { fn: newPath, text: newContent },
    ],
    [outputPath],
  );
}
