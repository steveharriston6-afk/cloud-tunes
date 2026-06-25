interface CacheEntry {
  body: string;
  etag: string;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

export class ResponseCache {
  constructor(private defaultTtlMs: number = 5000) {}

  get(key: string): { hit: boolean; body?: string; etag?: string } {
    const entry = store.get(key);
    if (entry && Date.now() < entry.expiresAt) {
      return { hit: true, body: entry.body, etag: entry.etag };
    }
    store.delete(key);
    return { hit: false };
  }

  set(key: string, body: string, ttlMs?: number): string {
    const etag = `"${Date.now().toString(36)}"`;
    store.set(key, {
      body,
      etag,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
    });
    return etag;
  }

  respond(key: string, req: any, res: any): boolean {
    const entry = this.get(key);
    if (!entry.hit) return false;
    if (req.headers['if-none-match'] === entry.etag) {
      res.status(304).end();
      return true;
    }
    res.setHeader('ETag', entry.etag!);
    res.setHeader('X-Cache', 'HIT');
    res.json(JSON.parse(entry.body!));
    return true;
  }

  invalidate(prefix?: string) {
    if (prefix) {
      for (const key of store.keys()) {
        if (key.startsWith(prefix)) store.delete(key);
      }
    } else {
      store.clear();
    }
  }
}

export const apiCache = new ResponseCache(5000);
