import { WebPerlRunner } from "wasm-latex-tools";
import { engineAssetUrl, getEngineCacheName, resolveAppBase } from "./engine-cache";
import { restoreEngineFromIdbToCache, saveEngineBlob } from "./engine-store";
import {
  engineCacheHasAllFiles,
  isServiceWorkerControlling,
  registerEngineServiceWorker,
} from "./register-sw";

export type RunnerState = "idle" | "loading" | "ready" | "error";

export type LoadStage = "download" | "runtime" | "ready" | "error";

export interface LoadProgress {
  stage: LoadStage;
  percent: number;
  message: string;
  detail: string;
}

const ENGINE_FILES = [
  { name: "emperl.data", weight: 65 },
  { name: "emperl.wasm", weight: 25 },
  { name: "emperl.js", weight: 5 },
  { name: "webperl.js", weight: 2 },
  { name: "perlrunner.html", weight: 3 },
] as const;

const DOWNLOAD_WEIGHT = 78;
const RUNTIME_START = 78;
const RUNTIME_END = 96;
const FETCH_TIMEOUT_MS = 90_000;
const INIT_TIMEOUT_MS = 120_000;
const CACHE_WAIT_MS = 120_000;

let runner: WebPerlRunner | null = null;
let state: RunnerState = "idle";
let initPromise: Promise<WebPerlRunner> | null = null;
let loadError: string | null = null;
/** WebPerl iframe reloads after each script; must be Ready before the next run. */
let perlRuntimeReady = false;

/** wasm-latex-tools stores the first Ready event.source; the iframe reloads after each run. */
type PerlRunnerInternals = WebPerlRunner & { perlRunner: Window | null };

function syncPerlRunnerTarget(activeRunner: WebPerlRunner): void {
  const iframe = document.querySelector<HTMLIFrameElement>('iframe[name="perlrunner"]');
  const win = iframe?.contentWindow;
  if (win) {
    (activeRunner as PerlRunnerInternals).perlRunner = win;
  }
}

function patchRunnerForIframeReload(activeRunner: WebPerlRunner): WebPerlRunner {
  const originalRunScript = activeRunner.runScript.bind(activeRunner);
  activeRunner.runScript = (...args: Parameters<WebPerlRunner["runScript"]>) => {
    syncPerlRunnerTarget(activeRunner);
    return originalRunScript(...args);
  };
  return activeRunner;
}
let perlReadyWaiters: Array<{ resolve: () => void; reject: (err: Error) => void }> = [];
let perlReadyListenerInstalled = false;

const PERL_READY_TIMEOUT_MS = 45_000;
const loadLog: string[] = [];
let progress: LoadProgress = {
  stage: "download",
  percent: 0,
  message: "Waiting…",
  detail: "",
};

const progressListeners = new Set<(p: LoadProgress) => void>();
const stateListeners = new Set<(s: RunnerState) => void>();
const logListeners = new Set<(lines: readonly string[]) => void>();

export function getRunnerState(): RunnerState {
  return state;
}

export function getLoadProgress(): LoadProgress {
  return { ...progress };
}

export function getLoadLog(): readonly string[] {
  return loadLog;
}

export function getRunner(): WebPerlRunner | null {
  return state === "ready" ? runner : null;
}

export function onRunnerStateChange(cb: (state: RunnerState) => void): () => void {
  stateListeners.add(cb);
  return () => stateListeners.delete(cb);
}

export function onLoadProgressChange(cb: (p: LoadProgress) => void): () => void {
  progressListeners.add(cb);
  cb({ ...progress });
  return () => progressListeners.delete(cb);
}

export function onLoadLogChange(cb: (lines: readonly string[]) => void): () => void {
  logListeners.add(cb);
  cb(loadLog);
  return () => logListeners.delete(cb);
}

function installPerlReadyListener(): void {
  if (perlReadyListenerInstalled) return;
  perlReadyListenerInstalled = true;
  window.addEventListener("message", (event) => {
    const data = event.data as { perlRunnerState?: string } | null;
    if (!data || typeof data !== "object") return;
    if (data.perlRunnerState === "Ready") {
      perlRuntimeReady = true;
      if (runner) {
        syncPerlRunnerTarget(runner);
      }
      const waiters = perlReadyWaiters;
      perlReadyWaiters = [];
      for (const w of waiters) {
        w.resolve();
      }
    } else if (data.perlRunnerState === "Ended") {
      perlRuntimeReady = false;
    }
  });
}

export function markPerlRuntimeBusy(): void {
  perlRuntimeReady = false;
}

/** Wait until the hidden perlrunner iframe is Ready (it reloads after every script). */
export function waitForPerlRuntimeReady(timeoutMs = PERL_READY_TIMEOUT_MS): Promise<void> {
  installPerlReadyListener();
  if (perlRuntimeReady) {
    if (runner) {
      syncPerlRunnerTarget(runner);
    }
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const entry = {
      resolve: () => {
        window.clearTimeout(timer);
        resolve();
      },
      reject: (err: Error) => {
        window.clearTimeout(timer);
        reject(err);
      },
    };
    perlReadyWaiters.push(entry);

    const timer = window.setTimeout(() => {
      perlReadyWaiters = perlReadyWaiters.filter((w) => w !== entry);
      reject(
        new Error(
          `Perl engine did not become ready within ${timeoutMs / 1000}s (it reloads after each diff). Try refreshing the page.`,
        ),
      );
    }, timeoutMs);

    const iframe = document.querySelector<HTMLIFrameElement>('iframe[name="perlrunner"]');
    iframe?.contentWindow?.postMessage({ perlRunnerDiscovery: 1 }, "*");
  });
}

function logLoad(line: string) {
  const stamp = new Date().toISOString().slice(11, 19);
  const entry = `${stamp} ${line}`;
  loadLog.push(entry);
  if (loadLog.length > 80) {
    loadLog.splice(0, loadLog.length - 80);
  }
  for (const cb of logListeners) {
    cb(loadLog);
  }
}

function emitProgress(next: Partial<LoadProgress> & Pick<LoadProgress, "message">) {
  progress = {
    stage: next.stage ?? progress.stage,
    percent: Math.min(100, Math.max(0, next.percent ?? progress.percent)),
    message: next.message,
    detail: next.detail ?? progress.detail,
  };
  for (const cb of progressListeners) {
    cb({ ...progress });
  }
}

function setState(next: RunnerState) {
  state = next;
  for (const cb of stateListeners) {
    cb(next);
  }
}

function webperlUrl(file: string): string {
  return engineAssetUrl(`core/webperl/${file}`);
}

function urlToAssetKey(url: string): string | null {
  try {
    const base = resolveAppBase();
    const path = new URL(url).pathname;
    const basePath = base.pathname.replace(/\/$/, "");
    if (!path.startsWith(basePath)) {
      return null;
    }
    return path.slice(basePath.length).replace(/^\//, "");
  } catch {
    return null;
  }
}

function webperlBasePath(): string {
  return engineAssetUrl("core/webperl").replace(/\/$/, "");
}

function perlScriptsPath(): string {
  return engineAssetUrl("core/perl").replace(/\/$/, "");
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function fetchAndStoreInCache(
  url: string,
  onBytes: (loaded: number, total: number) => void,
): Promise<void> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      cache: "default",
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }

    const total = Number(res.headers.get("content-length")) || 0;
    const body = res.body;

    if (!body || total <= 0) {
      const blob = await res.blob();
      onBytes(blob.size, blob.size || 1);
      if ("caches" in window) {
        const cache = await caches.open(getEngineCacheName());
        await cache.put(url, new Response(blob, { headers: res.headers }));
      }
      const assetKey = urlToAssetKey(url);
      if (assetKey) {
        await saveEngineBlob(assetKey, blob);
      }
      return;
    }

    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      onBytes(loaded, total);
    }

    const blob = new Blob(chunks);
    if ("caches" in window) {
      const cache = await caches.open(getEngineCacheName());
      await cache.put(url, new Response(blob, { headers: res.headers }));
    }
    const assetKey = urlToAssetKey(url);
    if (assetKey) {
      await saveEngineBlob(assetKey, blob);
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Timed out after ${FETCH_TIMEOUT_MS / 1000}s: ${url}`);
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}

/** Download engine files once into Cache API; service worker serves them same-origin afterward. */
async function populateEngineCache(): Promise<void> {
  let completedWeight = 0;
  let skipped = 0;

  for (const file of ENGINE_FILES) {
    const url = webperlUrl(file.name);
    emitProgress({
      stage: "download",
      percent: (completedWeight / 100) * DOWNLOAD_WEIGHT,
      message: `Caching ${file.name}`,
      detail: url,
    });
    logLoad(`GET ${url}`);

    try {
      await fetchAndStoreInCache(url, (loaded, total) => {
        const fileRatio = total > 0 ? loaded / total : 1;
        const overall = completedWeight + file.weight * fileRatio;
        emitProgress({
          stage: "download",
          percent: (overall / 100) * DOWNLOAD_WEIGHT,
          message: `Caching ${file.name}`,
          detail: total > 0 ? `${formatBytes(loaded)} / ${formatBytes(total)}` : file.name,
        });
      });
      logLoad(`OK ${file.name}`);
    } catch (err) {
      skipped += 1;
      const msg = err instanceof Error ? err.message : String(err);
      logLoad(`SKIP ${file.name}: ${msg}`);
    }

    completedWeight += file.weight;
  }

  if (skipped > 0) {
    logLoad(`Cache fill skipped ${skipped}/${ENGINE_FILES.length} file(s)`);
  } else {
    logLoad("Engine files cached");
  }

  emitProgress({
    stage: "download",
    percent: DOWNLOAD_WEIGHT,
    message: skipped > 0 ? "Cache partial — starting runtime" : "Engine cached",
    detail: "",
  });
}

async function waitForEngineCache(): Promise<boolean> {
  const deadline = Date.now() + CACHE_WAIT_MS;
  while (Date.now() < deadline) {
    if (await engineCacheHasAllFiles()) {
      return true;
    }
    await new Promise((r) => window.setTimeout(r, 400));
  }
  return engineCacheHasAllFiles();
}

async function prepareEngineCache(): Promise<void> {
  emitProgress({
    stage: "download",
    percent: 0,
    message: "Preparing engine cache…",
    detail: "",
  });

  logLoad("Registering service worker…");
  const swReg = await registerEngineServiceWorker();
  if (swReg) {
    logLoad("Service worker registered (engine shipped with app, same-origin)");
  } else {
    logLoad("Service worker unavailable — using browser cache only");
  }

  if (await restoreEngineFromIdbToCache()) {
    logLoad("Engine restored from local storage (no network)");
    emitProgress({
      stage: "download",
      percent: DOWNLOAD_WEIGHT,
      message: "Engine ready (local copy)",
      detail: "IndexedDB",
    });
    return;
  }

  if (await engineCacheHasAllFiles()) {
    logLoad(`Cache hit: ${getEngineCacheName()}`);
    emitProgress({
      stage: "download",
      percent: DOWNLOAD_WEIGHT,
      message: "Engine loaded from cache",
      detail: isServiceWorkerControlling() ? "Service worker" : "Cache API",
    });
    return;
  }

  if (swReg?.installing || swReg?.waiting) {
    emitProgress({
      stage: "download",
      percent: 5,
      message: "Downloading engine (first visit)…",
      detail: "Service worker caching",
    });
    logLoad("Waiting for service worker to cache engine files…");
    const ready = await waitForEngineCache();
    if (ready) {
      logLoad("Service worker cache ready");
      emitProgress({
        stage: "download",
        percent: DOWNLOAD_WEIGHT,
        message: "Engine cached for offline use",
        detail: "",
      });
      return;
    }
  }

  logLoad("Populating cache via fetch…");
  await populateEngineCache();
}

function createRunner(): WebPerlRunner {
  const base = webperlBasePath();
  const perl = perlScriptsPath();
  logLoad(`WebPerlRunner webperlBasePath=${base}`);
  logLoad(`WebPerlRunner perlScriptsPath=${perl}`);
  return patchRunnerForIframeReload(
    new WebPerlRunner({
      webperlBasePath: base,
      perlScriptsPath: perl,
      verbose: true,
    }),
  );
}

async function initializeRunner(): Promise<WebPerlRunner> {
  loadLog.length = 0;
  logLoad(`Page: ${window.location.href}`);
  logLoad(`BASE_URL: ${import.meta.env.BASE_URL}`);

  await prepareEngineCache();

  emitProgress({
    stage: "runtime",
    percent: RUNTIME_START,
    message: "Starting Perl runtime…",
    detail: webperlUrl("perlrunner.html"),
  });

  runner = createRunner();
  const iframeSrc = `${webperlBasePath()}/perlrunner.html`;
  logLoad(`iframe ${iframeSrc}`);

  const perlMessageHandler = (event: MessageEvent) => {
    const data = event.data as Record<string, unknown> | null;
    if (!data || typeof data !== "object") return;
    if (typeof data.perlRunnerError === "string") {
      logLoad(`perlRunnerError: ${data.perlRunnerError}`);
    }
    if (data.perlRunnerState === "Ready") {
      logLoad("perlRunnerState: Ready");
      perlRuntimeReady = true;
    }
  };
  installPerlReadyListener();
  window.addEventListener("message", perlMessageHandler);

  const tick = window.setInterval(() => {
    if (state !== "loading") {
      window.clearInterval(tick);
      return;
    }
    const p = progress.percent;
    if (p < RUNTIME_END) {
      emitProgress({
        stage: "runtime",
        percent: Math.min(RUNTIME_END, p + 1.5),
        message: "Initializing WebPerl…",
        detail: "Waiting for perlrunner Ready",
      });
    }
  }, 400);

  const initTimer = window.setTimeout(() => {
    logLoad(`ERROR init exceeded ${INIT_TIMEOUT_MS / 1000}s`);
  }, INIT_TIMEOUT_MS);

  try {
    logLoad("runner.initialize()…");
    await runner.initialize();
    logLoad("runner.initialize() done");
    await waitForPerlRuntimeReady();
    logLoad("perl runner Ready");
  } finally {
    window.clearTimeout(initTimer);
    window.clearInterval(tick);
    window.removeEventListener("message", perlMessageHandler);
  }

  emitProgress({
    stage: "ready",
    percent: 100,
    message: "Engine ready",
    detail: "",
  });
  logLoad("Engine ready");

  return runner;
}

/** Start loading WebPerl in the background (safe to call multiple times). */
export function startBackgroundLoad(): void {
  if (state === "ready" || state === "loading" || initPromise) {
    return;
  }

  setState("loading");
  initPromise = (async () => {
    try {
      const r = await initializeRunner();
      setState("ready");
      return r;
    } catch (err) {
      loadError = err instanceof Error ? err.message : String(err);
      logLoad(`FAILED: ${loadError}`);
      emitProgress({
        stage: "error",
        percent: progress.percent,
        message: "Engine failed to load",
        detail: loadError,
      });
      setState("error");
      initPromise = null;
      throw err;
    }
  })();
}

/** Wait until WebPerl is ready (starts load if needed). */
export async function ensureRunner(): Promise<WebPerlRunner> {
  if (state === "ready" && runner) {
    return runner;
  }
  if (initPromise) {
    return initPromise;
  }
  startBackgroundLoad();
  if (!initPromise) {
    throw new Error(loadError ?? "Failed to start WebPerl");
  }
  return initPromise;
}

export function getLoadError(): string | null {
  return loadError;
}
