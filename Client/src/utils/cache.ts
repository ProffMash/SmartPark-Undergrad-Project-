type CacheEntry<T> = {
  value: T;
  expiresAt: number | null;
};

const cache = new Map<string, CacheEntry<any>>();

export function makeKey(keyParts: Array<string | number | undefined | null>) {
  return keyParts.map((p) => (p === undefined || p === null ? '' : String(p))).join('|');
}

export function setCache<T>(key: string, value: T, ttlSeconds?: number) {
  const expiresAt = ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
  cache.set(key, { value, expiresAt });
}

export function getCache<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function deleteCache(key: string) {
  cache.delete(key);
}

export function clearCache() {
  cache.clear();
}

export function hasCache(key: string) {
  return getCache(key) !== undefined;
}

export default {
  makeKey,
  setCache,
  getCache,
  deleteCache,
  clearCache,
  hasCache,
};
