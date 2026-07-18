interface CacheEntry<T> {
  value?: T;
  expiresAt: number;
  inFlight?: Promise<T>;
}

export interface CacheReadOptions {
  force?: boolean;
}

export class ReadThroughCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  read(key: string, loader: () => Promise<T>, options: CacheReadOptions = {}) {
    const current = this.entries.get(key);
    if (current?.inFlight) return current.inFlight;
    if (!options.force && current?.value !== undefined && current.expiresAt > this.now()) {
      return Promise.resolve(current.value);
    }

    const next: CacheEntry<T> = current ?? { expiresAt: 0 };
    const inFlight = loader()
      .then((value) => {
        this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
        return value;
      })
      .catch((error) => {
        next.inFlight = undefined;
        this.entries.set(key, next);
        throw error;
      });
    next.inFlight = inFlight;
    this.entries.set(key, next);
    return inFlight;
  }

  clear(key?: string) {
    if (key === undefined) this.entries.clear();
    else this.entries.delete(key);
  }
}
