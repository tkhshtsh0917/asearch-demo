/** Stores optional model blobs by digest; cache failures never prevent verified network loads. */
const DATABASE = "ruri-pinned-assets-v1";
const MAX_BYTES = 64 * 1024 * 1024;
const MAX_ENTRIES = 16;
export const cacheStats = {
  readFailures: 0,
  writeFailures: 0,
  lastFailure: "",
};
function failureName(error: unknown): string {
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? String(error.name)
      : "CacheError";
  return [
    "QuotaExceededError",
    "InvalidStateError",
    "DataCloneError",
    "TypeError",
    "SecurityError",
    "UnknownError",
    "AbortError",
    "NotSupportedError",
  ].includes(name)
    ? name
    : "CacheError";
}

async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    let expired = false;
    const timer = setTimeout(() => {
      expired = true;
      reject(new Error("Cache open timeout"));
    }, 1000);
    request.onupgradeneeded = () => request.result.createObjectStore("assets");
    request.onerror = () => {
      clearTimeout(timer);
      reject(request.error);
    };
    request.onsuccess = () => {
      clearTimeout(timer);
      if (expired) request.result.close();
      else resolve(request.result);
    };
  });
}

export async function cachedBlob(
  key: string,
  bytes: number,
): Promise<Blob | undefined> {
  let db: IDBDatabase | undefined;
  try {
    db = await database();
    const connection = db;
    return await new Promise((resolve, reject) => {
      const tx = connection.transaction("assets", "readonly");
      const request = tx.objectStore("assets").get(key);
      request.onsuccess = () => {
        const value: unknown = request.result;
        resolve(
          value instanceof Blob && value.size === bytes ? value : undefined,
        );
      };
      request.onerror = () => reject(request.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (error) {
    cacheStats.readFailures++;
    cacheStats.lastFailure = failureName(error);
    return undefined;
  } finally {
    db?.close();
  }
}

export async function saveBlob(
  key: string,
  bytes: Uint8Array<ArrayBuffer>,
): Promise<void> {
  if (bytes.byteLength > MAX_BYTES) return;
  let db: IDBDatabase | undefined;
  try {
    db = await database();
    const connection = db;
    await new Promise<void>((resolve, reject) => {
      const tx = connection.transaction("assets", "readwrite");
      const store = tx.objectStore("assets");
      const cursor = store.openCursor();
      let total = bytes.byteLength,
        count = 1;
      cursor.onsuccess = () => {
        const row = cursor.result;
        if (!row) {
          if (total <= MAX_BYTES && count <= MAX_ENTRIES)
            store.put(new Blob([bytes]), key);
          return;
        }
        if (row.key !== key) {
          count++;
          total += row.value instanceof Blob ? row.value.size : MAX_BYTES;
        }
        if (total > MAX_BYTES || count > MAX_ENTRIES) return;
        row.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
  } catch (error) {
    cacheStats.writeFailures++;
    cacheStats.lastFailure = failureName(error);
    /* Optional persistence may be denied or exceed quota. */
  } finally {
    db?.close();
  }
}
