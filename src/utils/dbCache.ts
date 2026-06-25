class DBCache {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open('cloudtunes_cache', 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata');
        }
        if (!db.objectStoreNames.contains('artwork')) {
          db.createObjectStore('artwork');
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  // Get metadata item
  async getMetadata<T>(key: string): Promise<T | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction('metadata', 'readonly');
        const store = transaction.objectStore('metadata');
        const request = store.get(key);
        request.onsuccess = () => resolve((request.result as T) || null);
        request.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  // Set metadata item
  async setMetadata<T>(key: string, value: T): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction('metadata', 'readwrite');
        const store = transaction.objectStore('metadata');
        const request = store.put(value, key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch {
      // Ignore
    }
  }

  // Get artwork Blob URL
  async getArtwork(url: string): Promise<string | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction('artwork', 'readonly');
        const store = transaction.objectStore('artwork');
        const request = store.get(url);
        request.onsuccess = () => {
          if (request.result) {
            const blob = request.result as Blob;
            resolve(URL.createObjectURL(blob));
          } else {
            resolve(null);
          }
        };
        request.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  // Set artwork Blob
  async setArtwork(url: string, blob: Blob): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction('artwork', 'readwrite');
        const store = transaction.objectStore('artwork');
        const request = store.put(blob, url);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch {
      // Ignore
    }
  }
}

export const dbCache = new DBCache();
