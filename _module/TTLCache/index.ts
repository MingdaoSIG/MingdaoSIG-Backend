type Entry<T> = {
  expiresAt: number;
  value: Promise<T>;
};

/**
 * Small in-memory cache for expensive, read-only results.
 *
 * - Concurrent callers for the same key share one in-flight load.
 * - A load that rejects is not cached, so the next call retries.
 * - At most maxEntries keys are kept (oldest inserted is evicted first),
 *   because keys can come from request parameters.
 */
export default class TTLCache<T> {
  private entries = new Map<string, Entry<T>>();

  constructor(
    private ttlMs: number,
    private maxEntries = 500,
  ) {}

  getOrLoad(key: string, load: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const cached = this.entries.get(key);
    if (cached && cached.expiresAt > now) return cached.value;

    const value = load();
    this.entries.delete(key);
    this.entries.set(key, { expiresAt: now + this.ttlMs, value });
    value.catch(() => {
      if (this.entries.get(key)?.value === value) this.entries.delete(key);
    });

    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value as string;
      this.entries.delete(oldestKey);
    }

    return value;
  }

  clear() {
    this.entries.clear();
  }
}
