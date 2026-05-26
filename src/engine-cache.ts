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

export function engineAssetUrl(relativePath: string): string {
  const base = new URL(import.meta.env.BASE_URL, window.location.href);
  return new URL(relativePath, base).href;
}
