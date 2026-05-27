import type { LatexDiffOptions, ScriptResult, WebPerlRunner } from "wasm-latex-tools";
import {
  getRunner,
  isRecoverablePerlError,
  markPerlRuntimeBusy,
  preparePerlRuntimeForRun,
  recoverPerlRuntime,
  waitForPerlRuntimeAfterRun,
} from "./runner";

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

export interface RunLatexdiffHooks {
  onRetry?: () => void;
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

const DIFF_TIMEOUT_MS = 120_000;

function formatInputSize(chars: number): string {
  if (chars < 1024) return `${chars} chars`;
  if (chars < 1024 * 1024) return `${(chars / 1024).toFixed(1)} KB`;
  return `${(chars / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeDiffFailure(result: ScriptResult): string {
  const stderr = result.error?.trim();
  if (stderr) {
    const lines = stderr.split("\n").filter(Boolean);
    const tail = lines.slice(-8).join("\n");
    return tail.length > 600 ? `${tail.slice(0, 600)}…` : tail;
  }
  return `latexdiff failed (exit code ${result.exitCode ?? "unknown"})`;
}

function withRetryHint(msg: string): string {
  if (msg.includes("Try refreshing the page")) {
    return msg.replace(
      "Try refreshing the page.",
      "An automatic engine reset and retry also failed — try refreshing the page.",
    );
  }
  return `${msg}\n\nAn automatic engine reset and retry also failed — try refreshing the page.`;
}

async function runLatexdiffOnce(
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

  const activeRunner = await preparePerlRuntimeForRun(runner);
  markPerlRuntimeBusy();

  const runPromise = activeRunner.runScript(
    args,
    [
      ...scripts,
      { fn: oldPath, text: oldContent },
      { fn: newPath, text: newContent },
    ],
    [outputPath],
  );

  let timeoutId = 0;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(
        new Error(
          `latexdiff timed out after ${DIFF_TIMEOUT_MS / 1000}s (${formatInputSize(oldContent.length)} + ${formatInputSize(newContent.length)} input). Try smaller files or turn off heavy options.`,
        ),
      );
    }, DIFF_TIMEOUT_MS);
  });

  let result: ScriptResult;
  try {
    result = await Promise.race([runPromise, timeoutPromise]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Timeout waiting for script execution")) {
      throw new Error(
        `Perl engine timed out (60s). Large or complex .tex can be slow in the browser — not a network ban. ${formatInputSize(oldContent.length)} + ${formatInputSize(newContent.length)} input.`,
      );
    }
    throw err;
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (!result.success) {
    throw new Error(normalizeDiffFailure(result));
  }

  if (!result.output.trim()) {
    throw new Error(
      "latexdiff finished but produced no output. Check that Old and New are valid LaTeX and try simpler options.",
    );
  }

  await waitForPerlRuntimeAfterRun();

  return result;
}

/** Run latexdiff in WebPerl; throws on timeout, non-zero exit, or empty output. */
export async function runLatexdiff(
  runner: WebPerlRunner,
  oldContent: string,
  newContent: string,
  options: AppDiffOptions,
  hooks?: RunLatexdiffHooks,
): Promise<ScriptResult> {
  try {
    return await runLatexdiffOnce(runner, oldContent, newContent, options);
  } catch (err) {
    if (!isRecoverablePerlError(err)) {
      throw err;
    }

    hooks?.onRetry?.();
    await recoverPerlRuntime();
    const recoveredRunner = getRunner() ?? runner;

    try {
      return await runLatexdiffOnce(recoveredRunner, oldContent, newContent, options);
    } catch (retryErr) {
      const msg = retryErr instanceof Error ? retryErr.message : String(retryErr);
      if (isRecoverablePerlError(retryErr)) {
        throw new Error(withRetryHint(msg));
      }
      throw retryErr;
    }
  }
}

export { formatInputSize };
