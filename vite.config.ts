import { defineConfig } from "vite";

const buildTime = new Date().toISOString();

export default defineConfig({
  base: "./",
  define: {
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
});
