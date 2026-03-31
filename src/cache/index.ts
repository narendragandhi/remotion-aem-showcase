/**
 * Asset Caching Module
 *
 * Provides in-memory and disk caching for:
 * - AEM GraphQL responses
 * - Image assets
 * - Lottie animations
 *
 * Reduces network requests and improves render performance.
 */

import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { trackPerformance } from "../telemetry";

export interface CacheConfig {
  enabled: boolean;
  memoryMaxSize: number; // Max items in memory cache
  diskCacheDir: string;
  ttlMs: number; // Time-to-live in milliseconds
  persistToDisk: boolean;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  size?: number;
}

// Default configuration
const DEFAULT_CONFIG: CacheConfig = {
  enabled: process.env.CACHE_ENABLED !== "false",
  memoryMaxSize: parseInt(process.env.CACHE_MEMORY_MAX_SIZE || "100", 10),
  diskCacheDir: process.env.CACHE_DISK_DIR || ".cache/remotion",
  ttlMs: parseInt(process.env.CACHE_TTL_MS || String(30 * 60 * 1000), 10), // 30 minutes
  persistToDisk: process.env.CACHE_PERSIST_DISK === "true",
};

let config: CacheConfig = { ...DEFAULT_CONFIG };

// In-memory cache storage
const memoryCache = new Map<string, CacheEntry<unknown>>();

// LRU tracking
const accessOrder: string[] = [];

/**
 * Configure cache settings
 */
export const configureCache = (newConfig: Partial<CacheConfig>): void => {
  config = { ...config, ...newConfig };

  if (config.persistToDisk && !existsSync(config.diskCacheDir)) {
    mkdirSync(config.diskCacheDir, { recursive: true });
  }
};

/**
 * Generate cache key from URL or identifier
 */
export const generateCacheKey = (identifier: string, namespace = "default"): string => {
  const hash = createHash("sha256").update(identifier).digest("hex").slice(0, 16);
  return `${namespace}:${hash}`;
};

/**
 * Check if entry is expired
 */
const isExpired = (entry: CacheEntry<unknown>): boolean => {
  return Date.now() > entry.timestamp + entry.ttl;
};

/**
 * Evict oldest entries when cache is full
 */
const evictIfNeeded = (): void => {
  while (memoryCache.size >= config.memoryMaxSize && accessOrder.length > 0) {
    const oldestKey = accessOrder.shift();
    if (oldestKey) {
      memoryCache.delete(oldestKey);
      trackPerformance("cache_eviction", 1, "count", { key: oldestKey });
    }
  }
};

/**
 * Update LRU access order
 */
const touchKey = (key: string): void => {
  const index = accessOrder.indexOf(key);
  if (index > -1) {
    accessOrder.splice(index, 1);
  }
  accessOrder.push(key);
};

/**
 * Get item from cache
 */
export const getCached = <T>(key: string): T | null => {
  if (!config.enabled) return null;

  // Check memory cache first
  const memoryEntry = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (memoryEntry) {
    if (isExpired(memoryEntry)) {
      memoryCache.delete(key);
      trackPerformance("cache_expired", 1, "count", { key, source: "memory" });
      return null;
    }
    touchKey(key);
    trackPerformance("cache_hit", 1, "count", { key, source: "memory" });
    return memoryEntry.data;
  }

  // Check disk cache
  if (config.persistToDisk) {
    const diskPath = join(config.diskCacheDir, `${key.replace(/:/g, "_")}.json`);
    if (existsSync(diskPath)) {
      try {
        const content = readFileSync(diskPath, "utf-8");
        const diskEntry = JSON.parse(content) as CacheEntry<T>;

        if (isExpired(diskEntry)) {
          trackPerformance("cache_expired", 1, "count", { key, source: "disk" });
          return null;
        }

        // Promote to memory cache
        setCached(key, diskEntry.data, diskEntry.ttl);
        trackPerformance("cache_hit", 1, "count", { key, source: "disk" });
        return diskEntry.data;
      } catch {
        // Invalid cache file
        return null;
      }
    }
  }

  trackPerformance("cache_miss", 1, "count", { key });
  return null;
};

/**
 * Set item in cache
 */
export const setCached = <T>(
  key: string,
  data: T,
  ttlMs: number = config.ttlMs
): void => {
  if (!config.enabled) return;

  evictIfNeeded();

  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
    ttl: ttlMs,
    size: JSON.stringify(data).length,
  };

  memoryCache.set(key, entry);
  touchKey(key);

  // Persist to disk if enabled
  if (config.persistToDisk) {
    try {
      const diskPath = join(config.diskCacheDir, `${key.replace(/:/g, "_")}.json`);
      writeFileSync(diskPath, JSON.stringify(entry), "utf-8");
    } catch (error) {
      console.warn("[Cache] Failed to persist to disk:", error);
    }
  }

  trackPerformance("cache_set", 1, "count", { key, ttlMs });
};

/**
 * Invalidate cache entry
 */
export const invalidateCached = (key: string): void => {
  memoryCache.delete(key);
  const index = accessOrder.indexOf(key);
  if (index > -1) {
    accessOrder.splice(index, 1);
  }

  if (config.persistToDisk) {
    try {
      const diskPath = join(config.diskCacheDir, `${key.replace(/:/g, "_")}.json`);
      if (existsSync(diskPath)) {
        unlinkSync(diskPath);
      }
    } catch {
      // Ignore deletion errors
    }
  }
};

/**
 * Clear all cache entries
 */
export const clearCache = (): void => {
  memoryCache.clear();
  accessOrder.length = 0;
  trackPerformance("cache_clear", 1, "count", {});
};

/**
 * Get cache statistics
 */
export const getCacheStats = (): {
  enabled: boolean;
  memoryEntries: number;
  memoryMaxSize: number;
  totalSize: number;
  oldestEntry: string | null;
  newestEntry: string | null;
} => {
  let totalSize = 0;
  for (const entry of memoryCache.values()) {
    totalSize += entry.size || 0;
  }

  return {
    enabled: config.enabled,
    memoryEntries: memoryCache.size,
    memoryMaxSize: config.memoryMaxSize,
    totalSize,
    oldestEntry: accessOrder[0] || null,
    newestEntry: accessOrder[accessOrder.length - 1] || null,
  };
};

// ============================================================================
// High-Level Caching Functions
// ============================================================================

/**
 * Cache wrapper for fetch operations
 */
export const cachedFetch = async <T>(
  url: string,
  fetcher: () => Promise<T>,
  options: { namespace?: string; ttlMs?: number } = {}
): Promise<T> => {
  const key = generateCacheKey(url, options.namespace || "fetch");

  const cached = getCached<T>(key);
  if (cached !== null) {
    return cached;
  }

  const data = await fetcher();
  setCached(key, data, options.ttlMs);
  return data;
};

/**
 * Cache AEM GraphQL response
 */
export const cacheAemResponse = <T>(
  fragmentPath: string,
  data: T,
  ttlMs?: number
): void => {
  const key = generateCacheKey(fragmentPath, "aem");
  setCached(key, data, ttlMs);
};

/**
 * Get cached AEM response
 */
export const getCachedAemResponse = <T>(fragmentPath: string): T | null => {
  const key = generateCacheKey(fragmentPath, "aem");
  return getCached<T>(key);
};

/**
 * Cache asset (image, lottie, etc)
 */
export const cacheAsset = (url: string, data: ArrayBuffer | string): void => {
  const key = generateCacheKey(url, "asset");
  // For binary data, store as base64
  const storable = data instanceof ArrayBuffer
    ? Buffer.from(data).toString("base64")
    : data;
  setCached(key, storable);
};

/**
 * Get cached asset
 */
export const getCachedAsset = (url: string): ArrayBuffer | string | null => {
  const key = generateCacheKey(url, "asset");
  const cached = getCached<string>(key);
  if (cached === null) return null;

  // Try to decode as base64 for binary data
  try {
    const buffer = Buffer.from(cached, "base64");
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  } catch {
    return cached;
  }
};

/**
 * Preload and cache multiple assets
 */
export const preloadAssets = async (urls: string[]): Promise<void> => {
  const uncached = urls.filter((url) => getCachedAsset(url) === null);

  if (uncached.length === 0) return;

  console.info(`[Cache] Preloading ${uncached.length} assets...`);

  await Promise.all(
    uncached.map(async (url) => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.text();
          cacheAsset(url, data);
        }
      } catch (error) {
        console.warn(`[Cache] Failed to preload ${url}:`, error);
      }
    })
  );

  console.info(`[Cache] Preloading complete`);
};
