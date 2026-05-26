import { registerEngineServiceWorker } from "./register-sw";
import { restoreEngineFromIdbToCache } from "./engine-store";

/** Start caching engine files as early as possible (with the HTML load, not at Generate). */
function startEngineBootstrap(): void {
  void (async () => {
    await registerEngineServiceWorker();
    await restoreEngineFromIdbToCache();
  })();
}

startEngineBootstrap();
