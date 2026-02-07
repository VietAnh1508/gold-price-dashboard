interface MemoryEntry<T> {
  value: T;
  expiresAtMs: number;
}

const memoryCache = new Map<string, MemoryEntry<unknown>>();

export function getMemoryCache<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAtMs) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setMemoryCache<T>(key: string, value: T, ttlSeconds: number): void {
  memoryCache.set(key, {
    value,
    expiresAtMs: Date.now() + ttlSeconds * 1000,
  });
}
