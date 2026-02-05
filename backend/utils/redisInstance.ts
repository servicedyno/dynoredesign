import { createClient } from "redis";
import { log } from "./loggers";

const redisClient = createClient({
  url: process.env.REDIS_PUBLIC_URL,
  socket: {
    connectTimeout: 5000,
    reconnectStrategy: retries => Math.min(retries * 100, 3000),
  },
});

redisClient.on("error", err => {
  log(`Redis Client Error: ${err.message}`, "error");
});

let redisConnected = false;

export const connectRedis = async () => {
  if (!redisConnected) {
    await redisClient.connect();
    redisConnected = true;
    log("Redis connected", "info");
    log("[MemoryCache] Initialized", "info");
  }
};

// ============================================
// IN-MEMORY CACHE LAYER (for hot data - <1ms)
// ============================================
interface CacheEntry {
  value: unknown;
  expires: number;
}

const memoryCache = new Map<string, CacheEntry>();
// Note: MemoryCache initialization log moved to connectRedis() to ensure proper load order

// Set item in memory cache with TTL
const setMemoryCache = (key: string, value: unknown, ttlSeconds: number) => {
  memoryCache.set(key, {
    value,
    expires: Date.now() + (ttlSeconds * 1000)
  });
  console.log(`[MemoryCache] SET ${key} (size: ${memoryCache.size})`);
};

// Get item from memory cache
const getMemoryCache = (key: string): unknown | null => {
  const entry = memoryCache.get(key);
  if (!entry) {
    // Only log cache misses in development or for non-customer keys to reduce noise
    if (process.env.NODE_ENV === 'development' || !key.startsWith('customer-')) {
      console.log(`[MemoryCache] MISS ${key}`);
    }
    return null;
  }
  
  if (Date.now() > entry.expires) {
    memoryCache.delete(key);
    console.log(`[MemoryCache] EXPIRED ${key}`);
    return null;
  }
  
  console.log(`[MemoryCache] HIT ${key}`);
  return entry.value;
};

// Clear expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryCache.entries()) {
    if (now > entry.expires) {
      memoryCache.delete(key);
    }
  }
}, 60000); // Clean up every minute

// ============================================
// REDIS OPERATIONS (for distributed caching)
// ============================================

const setRedisItem = async (key: string, value: unknown) => {
  // Use shorter TTL for crypto payment keys (5 seconds) to ensure fresh status reads
  const cacheTTL = key.startsWith('crypto-') ? 5 : 30;
  
  // Also store in memory cache for fast access
  setMemoryCache(key, value, cacheTTL);
  
  // Store as JSON string for complex objects
  if (typeof value === 'object') {
    await redisClient.set(key + ':json', JSON.stringify(value));
    // Also delete any old hash data to prevent stale reads
    await redisClient.del(key);
  } else {
    for (const [field, val] of Object.entries(value)) {
      if (val !== undefined && val !== null) {
        await redisClient.hSet(key, field, val.toString());
      }
    }
  }
};

// Set Redis item with TTL (time-to-live in seconds)
const setRedisItemWithTTL = async (key: string, value: unknown, ttlSeconds: number) => {
  // Also store in memory cache
  setMemoryCache(key, value, ttlSeconds);
  
  for (const [field, val] of Object.entries(value)) {
    if (val !== undefined && val !== null) {
      await redisClient.hSet(key, field, val.toString());
    }
  }
  await redisClient.expire(key, ttlSeconds);
};

// Set TTL on existing key
const setRedisTTL = async (key: string, ttlSeconds: number) => {
  await redisClient.expire(key, ttlSeconds);
};

const getRedisItem = async (key: string) => {
  // Use shorter TTL for crypto payment keys (5 seconds) to ensure fresh status reads
  const cacheTTL = key.startsWith('crypto-') ? 5 : 30;
  
  // Check memory cache first (< 1ms)
  const memCached = getMemoryCache(key);
  if (memCached && Object.keys(memCached).length > 0) {
    console.log(`[Cache] Memory hit for ${key}`);
    return memCached;
  }
  
  // Check for JSON stored object FIRST (preferred storage for objects)
  const jsonValue = await redisClient.get(key + ':json');
  if (jsonValue) {
    try {
      const parsed = JSON.parse(jsonValue);
      setMemoryCache(key, parsed, cacheTTL); // Cache in memory with appropriate TTL
      return parsed;
    } catch (e) {
      console.log(`[Cache] JSON parse error for ${key}:json, falling back to hash`);
      // Not JSON or parse error, fall through to hash
    }
  }
  
  // Fall back to hash storage (only if JSON doesn't exist)
  const hashValue = await redisClient.hGetAll(key);
  if (hashValue && Object.keys(hashValue).length > 0) {
    setMemoryCache(key, hashValue, cacheTTL); // Cache in memory with appropriate TTL
    return hashValue;
  }
  
  // No data found
  return {};
};

const deleteRedisItem = async (key: string) => {
  memoryCache.delete(key);
  await redisClient.del(key);
  await redisClient.del(key + ':json');
};

// Invalidate memory cache only (useful when external process updates Redis)
const invalidateCache = (key: string) => {
  memoryCache.delete(key);
  console.log(`[MemoryCache] INVALIDATED ${key}`);
};

// Soft delete - set TTL instead of immediate deletion (for checkout polling)
const softDeleteRedisItem = async (key: string, ttlSeconds: number = 1800) => {
  // Default 30 minutes TTL to allow checkout to poll for status
  // IMPORTANT: Clear memory cache to prevent stale reads
  memoryCache.delete(key);
  await redisClient.expire(key, ttlSeconds);
  await redisClient.expire(key + ':json', ttlSeconds);
  console.log(`[Redis] Soft delete: ${key} will expire in ${ttlSeconds}s`);
};

// ============================================
// DISTRIBUTED LOCKING (for concurrency control)
// ============================================

/**
 * Acquire a distributed lock
 * @param lockKey - Unique key for the lock
 * @param ttlSeconds - Lock expiry time (prevents deadlock)
 * @param maxRetries - Number of retry attempts
 * @param retryDelayMs - Delay between retries
 * @returns true if lock acquired, false otherwise
 */
const acquireLock = async (
  lockKey: string,
  ttlSeconds: number = 30,
  maxRetries: number = 3,
  retryDelayMs: number = 100
): Promise<boolean> => {
  const fullKey = `lock:${lockKey}`;
  const lockValue = `${process.pid}:${Date.now()}`;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // SET NX (only if not exists) with EX (expiry)
    const result = await redisClient.set(fullKey, lockValue, {
      NX: true,
      EX: ttlSeconds
    });
    
    if (result === 'OK') {
      console.log(`[Lock] Acquired: ${lockKey}`);
      return true;
    }
    
    // Wait before retry
    if (attempt < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    }
  }
  
  console.log(`[Lock] Failed to acquire after ${maxRetries} attempts: ${lockKey}`);
  return false;
};

/**
 * Release a distributed lock
 * @param lockKey - Unique key for the lock
 */
const releaseLock = async (lockKey: string): Promise<void> => {
  const fullKey = `lock:${lockKey}`;
  await redisClient.del(fullKey);
  console.log(`[Lock] Released: ${lockKey}`);
};

/**
 * Execute a function with a distributed lock
 * @param lockKey - Unique key for the lock
 * @param fn - Function to execute while holding the lock
 * @param ttlSeconds - Lock expiry time
 * @returns Result of the function or null if lock could not be acquired
 */
const withLock = async <T>(
  lockKey: string,
  fn: () => Promise<T>,
  ttlSeconds: number = 30
): Promise<{ success: boolean; result?: T; error?: string }> => {
  const acquired = await acquireLock(lockKey, ttlSeconds);
  
  if (!acquired) {
    return { success: false, error: 'Could not acquire lock' };
  }
  
  try {
    const result = await fn();
    return { success: true, result };
  } finally {
    await releaseLock(lockKey);
  }
};

export { 
  setRedisItem, 
  setRedisItemWithTTL, 
  setRedisTTL, 
  getRedisItem, 
  deleteRedisItem, 
  softDeleteRedisItem, 
  setMemoryCache, 
  getMemoryCache, 
  invalidateCache,
  acquireLock,
  releaseLock,
  withLock,
  redisClient as redis, // Export redis client for advanced operations like KEYS
};
