import { defineConfig, type Plugin } from "vite";
import { ENGINE_ASSETS } from "./scripts/engine-assets.cjs";

const buildTime = new Date().toISOString();

function enginePreloadPlugin(): Plugin {
  return {
    name: "engine-preload",
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        const base = ctx.server?.config?.base ?? "./";
        const tags = ENGINE_ASSETS.map((asset) => {
          const href = `${base}${asset.path}`;
          const cross = asset.as === "fetch" ? ' crossorigin="anonymous"' : "";
          const type = asset.mime ? ` type="${asset.mime}"` : "";
          return `    <link rel="preload" href="${href}" as="${asset.as}"${type}${cross} />`;
        }).join("\n");
        return html.replace(
          "</head>",
          `    <!-- Engine bundle: shipped with deploy, preloaded with page (not fetched from third parties) -->\n${tags}\n  </head>`,
        );
      },
    },
  };
}

export default defineConfig({
  base: "./",
  define: {
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  plugins: [enginePreloadPlugin()],
});
