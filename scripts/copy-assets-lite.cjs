/**
 * Copy only assets needed for latexdiff (skip texfmt ~2MB).
 */
const { copyAssets } = require("wasm-latex-tools/scripts/copy-assets.cjs");
const fs = require("fs");
const path = require("path");

const dest = path.resolve(process.cwd(), "./public/core");

copyAssets(dest)
  .then(() => {
    const texfmt = path.join(dest, "texfmt");
    if (fs.existsSync(texfmt)) {
      fs.rmSync(texfmt, { recursive: true, force: true });
      console.log("✓ Removed unused texfmt assets");
    }
  })
  .catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
  });
