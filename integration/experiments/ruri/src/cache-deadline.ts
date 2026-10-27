/** Bounds optional IndexedDB work even when the browser never delivers a transaction event. */
export function cacheDeadline(
  tx: IDBTransaction,
  reject: (error: Error) => void,
) {
  const timer = setTimeout(() => {
    try {
      tx.abort();
    } catch {
      /* A transaction may already be inactive. */
    }
    reject(new Error("Cache transaction timeout"));
  }, 2000);
  return () => clearTimeout(timer);
}
