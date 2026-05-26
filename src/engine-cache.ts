import pkg from "../package.json";

export const ENGINE_CACHE_NAME = `latexdiff-engine-${pkg.version}`;

export function getEngineCacheName(): string {
  return ENGINE_CACHE_NAME;
}

export const ENGINE_CACHE_PATHS = [
  "core/webperl/perlrunner.html",
  "core/webperl/webperl.js",
  "core/webperl/emperl.js",
  "core/webperl/emperl.wasm",
  "core/webperl/emperl.data",
  "core/perl/latexdiff.pl",
] as const;

/** Absolute site base (Vite `base` is `./`, which is not valid alone for `new URL`). */
export function resolveAppBase(): URL {
  return new URL(import.meta.env.BASE_URL, window.location.href);
}

export function engineAssetUrl(relativePath: string): string {
  return new URL(relativePath, resolveAppBase()).href;
}
