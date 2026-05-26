import { getEngineCacheName } from "./engine-cache";
import { engineAssetUrl } from "./engine-cache";

const DB_NAME = getEngineCacheName();
const STORE_NAME = "blobs";
const DB_VERSION = 1;

const REQUIRED_KEYS = [
  "core/webperl/emperl.wasm",
  "core/webperl/emperl.data",
  "core/webperl/perlrunner.html",
] as const;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

function idbGetAll(store: IDBObjectStore): Promise<Array<{ key: string; blob: Blob }>> {
  return new Promise((resolve, reject) => {
    const keysReq = store.getAllKeys();
    keysReq.onerror = () => reject(keysReq.error);
    keysReq.onsuccess = () => {
      const keys = keysReq.result.map(String);
      const blobsReq = store.getAll();
      blobsReq.onerror = () => reject(blobsReq.error);
      blobsReq.onsuccess = () => {
        const blobs = blobsReq.result as Blob[];
        resolve(keys.map((key, i) => ({ key, blob: blobs[i] })));
      };
    };
  });
}

/** Persist one engine file locally (survives tab close; no runtime network next visit). */
export async function saveEngineBlob(assetKey: string, blob: Blob): Promise<void> {
  if (!("indexedDB" in window)) {
    return;
  }
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE_NAME).put(blob, assetKey);
  });
}

/** Copy stored blobs into Cache API so WebPerl iframe reads same-origin cache, not the network. */
export async function restoreEngineFromIdbToCache(): Promise<boolean> {
  if (!("indexedDB" in window) || !("caches" in window)) {
    return false;
  }

  const db = await openDb();
  const items = await new Promise<Array<{ key: string; blob: Blob }>>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore(STORE_NAME);
    idbGetAll(store).then(resolve, reject);
  });

  const byKey = new Map(items.map((i) => [i.key, i.blob]));
  if (!REQUIRED_KEYS.every((k) => byKey.has(k))) {
    return false;
  }

  const cache = await caches.open(getEngineCacheName());
  for (const [key, blob] of byKey) {
    const url = engineAssetUrl(key);
    await cache.put(url, new Response(blob, { headers: { "Content-Type": guessMime(key) } }));
  }
  return true;
}

function guessMime(path: string): string {
  if (path.endsWith(".wasm")) return "application/wasm";
  if (path.endsWith(".js")) return "application/javascript";
  if (path.endsWith(".html")) return "text/html";
  if (path.endsWith(".pl")) return "text/plain";
  return "application/octet-stream";
}
