/// <reference types="vite/client" />

declare const __BUILD_TIME__: string;

declare module "*.tex?raw" {
  const content: string;
  export default content;
}
