import { getEngineCacheName } from "./engine-cache";

/** Register service worker so WebPerl assets are cached same-origin (no repeat CORS/network). */
export async function registerEngineServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) {
    return null;
  }

  const swUrl = new URL("sw.js", import.meta.env.BASE_URL).href;
  const scope = new URL("./", import.meta.env.BASE_URL).href;

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

  const base = new URL(import.meta.env.BASE_URL, window.location.href);
  const required = [
    "core/webperl/emperl.wasm",
    "core/webperl/emperl.data",
    "core/webperl/perlrunner.html",
  ];

  return required.every((path) => urls.has(new URL(path, base).href));
}
