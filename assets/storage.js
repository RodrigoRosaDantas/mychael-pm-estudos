const DB_NAME = 'mychael-pm';
const DB_VERSION = 1;
const QUEUE_STORE = 'syncQueue';

export function openProgressQueue() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueueProgress(event) {
  const db = await openProgressQueue();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    tx.objectStore(QUEUE_STORE).put(event);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
