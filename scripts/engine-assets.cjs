/** Shared list of WebPerl + perl files shipped under public/ (same deploy, same origin). */
module.exports.ENGINE_ASSETS = [
  { path: "core/webperl/perlrunner.html", as: "fetch" },
  { path: "core/webperl/webperl.js", as: "script" },
  { path: "core/webperl/emperl.js", as: "script" },
  { path: "core/webperl/emperl.wasm", as: "fetch", mime: "application/wasm" },
  { path: "core/webperl/emperl.data", as: "fetch" },
  { path: "core/perl/latexdiff.pl", as: "fetch" },
  { path: "core/perl/latexpand.pl", as: "fetch" },
  { path: "core/perl/texcount.pl", as: "fetch" },
];

module.exports.ENGINE_ASSET_PATHS = module.exports.ENGINE_ASSETS.map((a) => a.path);
