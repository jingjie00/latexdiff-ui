# latexdiff (browser)

Frontend-only UI for [latexdiff](https://ctan.org/pkg/latexdiff). Compare **x.tex** (old) and **y.tex** (new), get **diff.tex** — all in the browser via [wasm-latex-tools](https://github.com/TeXlyre/wasm-latex-tools). No server, no upload.

## Requirements

- Node.js 18+
- A modern browser (Chrome, Firefox, Safari, Edge)

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Build static site

```bash
npm run build
npm run preview
```

Deploy the `dist/` folder to any static host (GitHub Pages, Netlify, etc.).

## Notes

- First visit loads WebPerl WASM (~few MB); startup takes a few seconds.
- Behavior follows the bundled `latexdiff` in wasm-latex-tools, not necessarily your TeX Live install.
- **Flatten** only works when included files are available in the WASM filesystem; for simple single-file `.tex` pairs, leave it off.

## License

The web app is MIT. `wasm-latex-tools` is AGPL-3.0 — check their license if you redistribute a hosted build.
