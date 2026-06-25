import fs from 'fs';
import path from 'path';

class LRUCache<K, V> {
  private maxBytes: number;
  private currentBytes: number = 0;
  private cache: Map<K, { value: V; size: number; lastUsed: number }> = new Map();

  constructor(maxBytes: number) {
    this.maxBytes = maxBytes;
  }

  get(key: K): V | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    entry.lastUsed = Date.now();
    return entry.value;
  }

  set(key: K, value: V, size: number) {
    // Evict until we have enough space
    while (this.currentBytes + size > this.maxBytes && this.cache.size > 0) {
      let oldestKey: K | null = null;
      let oldestTime = Infinity;
      for (const [k, v] of this.cache.entries()) {
        if (v.lastUsed < oldestTime) {
          oldestTime = v.lastUsed;
          oldestKey = k;
        }
      }
      if (oldestKey !== null) {
        const entry = this.cache.get(oldestKey)!;
        this.currentBytes -= entry.size;
        this.cache.delete(oldestKey);
      }
    }

    if (this.currentBytes + size <= this.maxBytes) {
      this.cache.set(key, { value, size, lastUsed: Date.now() });
      this.currentBytes += size;
    }
  }
}

export class SmartCacheService {
  private l1: LRUCache<string, { buffer: Buffer; contentType: string }>;
  private cacheDir: string;

  constructor(cacheDir: string, maxL1Bytes: number) {
    this.cacheDir = cacheDir;
    this.l1 = new LRUCache(maxL1Bytes);
    fs.mkdirSync(this.cacheDir, { recursive: true });
  }

  private getDiskPath(key: string, namespace: string): string {
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.cacheDir, namespace, safeKey);
  }

  async get(key: string, namespace: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    const cacheKey = `${namespace}:${key}`;
    const l1Result = this.l1.get(cacheKey);
    if (l1Result) {
      return l1Result;
    }

    const diskPath = this.getDiskPath(key, namespace);
    const metaPath = diskPath + '.meta';
    if (fs.existsSync(diskPath) && fs.existsSync(metaPath)) {
      try {
        const buffer = await fs.promises.readFile(diskPath);
        const metaStr = await fs.promises.readFile(metaPath, 'utf-8');
        const meta = JSON.parse(metaStr);
        this.l1.set(cacheKey, { buffer, contentType: meta.contentType }, buffer.length);
        return { buffer, contentType: meta.contentType };
      } catch (err) {
        console.error('[Cache] Error reading L2 cache:', err);
      }
    }
    return null;
  }

  async set(key: string, namespace: string, buffer: Buffer, contentType: string): Promise<void> {
    const cacheKey = `${namespace}:${key}`;
    this.l1.set(cacheKey, { buffer, contentType }, buffer.length);

    const diskPath = this.getDiskPath(key, namespace);
    const metaPath = diskPath + '.meta';
    try {
      await fs.promises.mkdir(path.dirname(diskPath), { recursive: true });
      await fs.promises.writeFile(diskPath, buffer);
      await fs.promises.writeFile(metaPath, JSON.stringify({ contentType, savedAt: new Date().toISOString() }));
    } catch (err) {
      console.error('[Cache] Error writing L2 cache:', err);
    }
  }
}

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
export const cacheService = new SmartCacheService(
  path.resolve(PROJECT_ROOT, 'data', 'cache'),
  80 * 1024 * 1024 // 80 MB (strictly under 100 MB limit)
);
