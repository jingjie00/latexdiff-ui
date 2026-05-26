# LaTeX Different — Tracked Changes

A **browser-only** web app for comparing two LaTeX sources and producing a **tracked-changes** file — the same kind of output you get from the classic [`latexdiff`](https://github.com/ftilmann/latexdiff) command-line tool, but without installing Perl or uploading your manuscript anywhere.

Paste or drop your old and new `.tex` files, click **Generate**, then copy or download `diff.tex` and compile it locally. Everything runs on your machine inside the tab.

**Live demo:** deploy from this repo (e.g. Firebase Hosting) · **Source:** [github.com/jingjie00/latexdiff-ui](https://github.com/jingjie00/latexdiff-ui)

---

## Table of contents

- [Why this exists](#why-this-exists)
- [Features](#features)
- [How to use (workflow)](#how-to-use-workflow)
- [How it works](#how-it-works)
- [Requirements](#requirements)
- [Development](#development)
- [Build and deploy](#build-and-deploy)
- [Project layout](#project-layout)
- [Limitations](#limitations)
- [Acknowledgements](#acknowledgements)
- [License](#license)

---

## Why this exists

Academic writing often means juggling two versions of the same paper — e.g. an old `main.tex` and a revised `main.tex` from a co-author, backup, or git checkout. The standard tool for visualising changes in LaTeX is **[latexdiff](https://github.com/ftilmann/latexdiff)** by F. Tilmann: it compares two `.tex` files and emits a third file marked up with `\DIFadd{…}` and `\DIFdel{…}` (and related macros) so you can **compile a PDF with visible insertions and deletions**.

That usually means:

1. Installing Perl and `latexdiff` (or using a TeX distribution that includes it).
2. Running a terminal command on files that may live on another machine.

**LaTeX Different** wraps the same diff engine in a simple three-column UI and runs it via **WebAssembly + WebPerl** in the browser. Your sources never leave your computer.

---

## Features

| Area | What you get |
|------|----------------|
| **Privacy** | No backend, no upload — diff runs entirely client-side |
| **Editors** | Three columns: **Old**, **New**, **Tracked Changes** (editable, with line numbers) |
| **Input** | Paste plain text, drag-and-drop `.tex`, or paste files from the OS file manager |
| **Output** | Copy or download generated `diff.tex`; **Source / Preview** toggle with coloured `\DIFadd` / `\DIFdel` highlighting |
| **Options** | Collapsible panel for common `latexdiff` flags (`--type`, `--subtype`, `--floattype`, `--math-markup`, `--encoding`, `--flatten`, `--allow-spaces`) |
| **UX** | Light/dark theme, **Load demo** samples, in-app **tutorial** and **about** popovers |
| **Engine** | Background load of WebPerl; first visit caches ~15 MB via service worker (same-origin, fast return visits) |

---

## How to use (workflow)

Typical paper workflow:

1. **Old column** — Paste or drop the **previous** version of your manuscript (often `main.tex` from an older draft or branch).
2. **New column** — Paste or drop the **revised** version (the updated `main.tex`).
3. Click **Generate** and wait for the WebPerl engine (first time may take a minute while assets download).
4. Review the result in **Tracked Changes** — use **Preview** to see coloured additions/deletions, or **Source** for raw LaTeX.
5. **Copy** or **Download** the output, save it as `diff.tex` (or another name) in the **same project folder** as your figures, bibliography, and `\input` files.
6. **Compile `diff.tex`**, not `main.tex`:

   ```bash
   pdflatex diff.tex
   # or latexmk, Overleaf “Recompile” on diff.tex, etc.
   ```

> **Important:** `main.tex` is unchanged. Only the generated diff file contains `\DIFadd` / `\DIFdel` markup. Compiling `main.tex` will **not** show tracked changes.

Use **Load demo** in the header to try a small built-in pair without your own files. Open the **tutorial** (graduation-cap icon) or **about** (ⓘ) in the toolbar for the same guidance inside the app.

---

## How it works

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Old .tex   │     │  wasm-latex-tools │     │  diff.tex       │
│  New .tex   │ ──► │  WebPerlRunner    │ ──► │  (\DIFadd/      │
│  (browser)  │     │  + latexdiff.pl   │     │   \DIFdel…)     │
└─────────────┘     └──────────────────┘     └─────────────────┘
```

- **[wasm-latex-tools](https://github.com/TeXlyre/wasm-latex-tools)** bundles `latexdiff.pl` and runs it through **[WebPerl](http://webperl.zero-g.net/)** (Perl 5 compiled to WebAssembly) inside a hidden iframe (`perlrunner.html`).
- Static assets (`emperl.wasm`, `emperl.data`, Perl scripts) live under `public/core/` and are copied on `npm install` via `scripts/copy-assets-lite.cjs` (texfmt omitted to save ~2 MB).
- The UI is **Vite 6 + TypeScript**, no framework — vanilla HTML/CSS/TS modules.

---

## Requirements

- **Node.js 18+** (for development and building only)
- A modern browser with WebAssembly: Chrome, Firefox, Safari, or Edge
- For the **PDF**: a local LaTeX installation (TeX Live, MiKTeX, Overleaf, etc.) — this app does not compile PDFs

---

## Development

```bash
git clone https://github.com/jingjie00/latexdiff-ui.git
cd latexdiff-ui
npm install          # copies WebPerl + latexdiff assets into public/core/
npm run dev          # http://localhost:5173
```

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Serve `dist/` locally to test the production bundle |

`postinstall` runs `node scripts/copy-assets-lite.cjs`, which invokes `wasm-latex-tools`’s copy script and removes unused `texfmt` assets.

---

## Build and deploy

```bash
npm run build
```

Deploy the **`dist/`** directory to any static host. Paths use Vite `base: "./"` so relative URLs work on subpaths.

### Firebase Hosting (this repo)

GitHub Actions workflows build `dist/` and deploy with the Firebase CLI:

- `.github/workflows/firebase-hosting-merge.yml` — deploy on push to `main`
- `.github/workflows/firebase-hosting-pull-request.yml` — preview channels for PRs

Local Firebase project id: `latexdiff` (see `.firebaserc`). Hosting serves the **`dist/`** folder (`firebase.json` → `"public": "dist"`).

After each deploy, the page footer shows **built** with the date/time in **24-hour GMT** from when `npm run build` ran in CI. Use it to confirm the live site matches your latest GitHub push.

**Hosting tips for WebPerl:**

- Ensure `core/webperl/*` and `core/perl/*` are served (they are copied into `dist/` from `public/`).
- Enable **gzip/brotli** for `.wasm` and `.data` files to speed first load.
- `firebase.json` sets `Content-Type: application/wasm` for `.wasm` files.

### Other hosts

GitHub Pages, Netlify, Cloudflare Pages, etc. — upload `dist/` as the site root. If you use a project-site subpath, set Vite `base` to match (e.g. `base: '/latexdiff-ui/'`).

---

## Project layout

```
latexdiff-ui/
├── index.html              # App shell
├── src/
│   ├── main.ts             # Wiring, Generate, demo
│   ├── runner.ts           # WebPerl load + progress
│   ├── column.ts           # Drag-drop columns
│   ├── diff-highlight.ts   # Preview highlighting
│   ├── options-panel.ts    # Collapsible latexdiff options
│   ├── popover.ts          # Tutorial / About popovers
│   └── …
├── public/core/            # Generated by postinstall (gitignored)
│   ├── webperl/            # WASM runtime (~15 MB)
│   └── perl/               # latexdiff.pl, etc.
├── samples/                # demo-old.tex, demo-new.tex
├── scripts/copy-assets-lite.cjs
└── firebase.json
```

---

## Limitations

- **Bundled `latexdiff` version** comes from `wasm-latex-tools`, not your system TeX Live — options and behaviour follow that bundle.
- **`--flatten`** only inlines `\input`/`\include` when those files are available inside the WASM filesystem; for typical single-file `main.tex` pairs, leave flatten **off**.
- **First visit** downloads large WASM assets into a service worker cache (`sw.js`); repeat visits load from cache (same origin). Slow first loads show progress in the status bar.
- **Very large** `.tex` files may be slow or hit browser memory limits.
- **Complex packages** — same caveats as desktop `latexdiff` (see the [manual](http://mirrors.ctan.org/support/latexdiff/doc/latexdiff-man.pdf)).
- This app **does not** replace `latexdiff-vc`, `latexrevise`, or citation-aware wrappers like [latexdiffcite](https://github.com/twilsonco/latexdiffcite).

---

## Acknowledgements

This project is a thin UI on top of excellent existing tools. Credit belongs to their authors and communities.

### Core diff engine

- **[latexdiff](https://github.com/ftilmann/latexdiff)** — F. Tilmann. Compares two LaTeX files and marks significant differences. Distributed on [CTAN](https://ctan.org/pkg/latexdiff); licensed under **GPL-3.0**.  
  Manual: [latexdiff-man.pdf](http://mirrors.ctan.org/support/latexdiff/doc/latexdiff-man.pdf)

### Browser runtime

- **[wasm-latex-tools](https://github.com/TeXlyre/wasm-latex-tools)** — Packages `latexdiff` (and related Perl tools) for in-browser use via WebPerl. **AGPL-3.0** — review their license if you redistribute a hosted build.
- **[WebPerl](http://webperl.zero-g.net/)** — Perl 5 compiled to WebAssembly (Emscripten), enabling `latexdiff.pl` to run without a native Perl install.

### Dependencies and algorithms

- **Algorithm::Diff** (and related diff machinery used inside `latexdiff`) — see upstream `latexdiff` documentation and [CPAN](https://metacpan.org/dist/Algorithm-Diff).
- **Vite**, **TypeScript** — build tooling.

### Related projects (not bundled, but worth knowing)

- [latexdiff-vc](https://github.com/ftilmann/latexdiff) — version-control wrappers (git, svn, …)
- [latexrevise](https://github.com/ftilmann/latexdiff) — accept/reject changes in diff output
- [git-latexdiff](https://gitlab.com/git-latexdiff/git-latexdiff) — git-focused wrapper
- [latexdiffcite](https://github.com/twilsonco/latexdiffcite) — improved citation diffing

### This UI

- **LaTeX Different** (this repository) — UI and integration by **[Tan Jing Jie](https://jingjietan.com)**.

If you use this app in academic work, please cite the original **latexdiff** paper/package as appropriate for your field, and consider starring or contributing to [ftilmann/latexdiff](https://github.com/ftilmann/latexdiff) and [TeXlyre/wasm-latex-tools](https://github.com/TeXlyre/wasm-latex-tools).

---

## License

| Component | License |
|-----------|---------|
| **This web UI** (`latexdiff-ui`) | MIT (see below) |
| **wasm-latex-tools** (bundled engine) | AGPL-3.0 — [repository](https://github.com/TeXlyre/wasm-latex-tools) |
| **latexdiff** (Perl script in bundle) | GPL-3.0 — [repository](https://github.com/ftilmann/latexdiff) |
| **WebPerl** | Artistic License / GPL — see files under `public/core/webperl/` |

MIT License (this repository’s own source: `src/`, `index.html`, etc.):

```
Copyright (c) Tan Jing Jie

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

When you **deploy a hosted copy**, you are distributing a build that includes AGPL/GPL components — ensure your deployment complies with those licenses (source offer, attribution, etc.).

---

## Contact

- Author: [Tan Jing Jie](https://jingjietan.com)
- Issues and contributions: [github.com/jingjie00/latexdiff-ui/issues](https://github.com/jingjie00/latexdiff-ui/issues)
