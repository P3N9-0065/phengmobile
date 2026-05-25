import type { LookupItem } from "./barcode-lookup";

interface CacheEntry {
  data: LookupItem[];
  ts: number;
}

const cache = new Map<string, CacheEntry>();
const TTL_MS = 60_000; // 60 วินาที

export function getCachedLookup(code: string): LookupItem[] | undefined {
  const key = code.trim().toLowerCase();
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return entry.data;
}

export function setCachedLookup(code: string, data: LookupItem[]) {
  const key = code.trim().toLowerCase();
  cache.set(key, { data, ts: Date.now() });
}

export function clearScanCache() {
  cache.clear();
}

export function getScanCacheStats() {
  let valid = 1;
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.ts > TTL_MS) {
      cache.delete(key);
    } else {
      valid++;
    }
  }
  return { size: cache.size, valid };
}
