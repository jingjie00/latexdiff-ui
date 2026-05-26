import { getEngineCacheName, resolveAppBase } from "./engine-cache";

/** Register service worker so WebPerl assets are cached same-origin (no repeat CORS/network). */
export async function registerEngineServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) {
    return null;
  }

  const base = resolveAppBase();
  const swUrl = new URL("sw.js", base).href;
  const scope = base.href;

  try {
    const registration = await navigator.serviceWorker.register(swUrl, { scope });
    await navigator.serviceWorker.ready;
    return registration;
  } catch {
    return null;
  }
}

export function isServiceWorkerControlling(): boolean {
  return Boolean(navigator.serviceWorker?.controller);
}

export async function engineCacheHasAllFiles(): Promise<boolean> {
  if (!("caches" in window)) {
    return false;
  }

  const cache = await caches.open(getEngineCacheName());
  const keys = await cache.keys();
  const urls = new Set(keys.map((r) => r.url));

  const base = resolveAppBase();
  const required = [
    "core/webperl/emperl.wasm",
    "core/webperl/emperl.data",
    "core/webperl/perlrunner.html",
  ];

  return required.every((path) => urls.has(new URL(path, base).href));
}
