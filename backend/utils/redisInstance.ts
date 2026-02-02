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
  value: any;
  expires: number;
}

const memoryCache = new Map<string, CacheEntry>();
// Note: MemoryCache initialization log moved to connectRedis() to ensure proper load order

// Set item in memory cache with TTL
const setMemoryCache = (key: string, value: any, ttlSeconds: number) => {
  memoryCache.set(key, {
    value,
    expires: Date.now() + (ttlSeconds * 1000)
  });
  console.log(`[MemoryCache] SET ${key} (size: ${memoryCache.size})`);
};

// Get item from memory cache
const getMemoryCache = (key: string): any | null => {
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

const setRedisItem = async (key: string, value: any) => {
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
const setRedisItemWithTTL = async (key: string, value: any, ttlSeconds: number) => {
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
      setMemoryCache(key, parsed, 30); // Cache in memory
      return parsed;
    } catch (e) {
      console.log(`[Cache] JSON parse error for ${key}:json, falling back to hash`);
      // Not JSON or parse error, fall through to hash
    }
  }
  
  // Fall back to hash storage (only if JSON doesn't exist)
  const hashValue = await redisClient.hGetAll(key);
  if (hashValue && Object.keys(hashValue).length > 0) {
    setMemoryCache(key, hashValue, 30); // Cache in memory
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

// Soft delete - set TTL instead of immediate deletion (for checkout polling)
const softDeleteRedisItem = async (key: string, ttlSeconds: number = 1800) => {
  // Default 30 minutes TTL to allow checkout to poll for status
  // IMPORTANT: Clear memory cache to prevent stale reads
  memoryCache.delete(key);
  await redisClient.expire(key, ttlSeconds);
  await redisClient.expire(key + ':json', ttlSeconds);
  console.log(`[Redis] Soft delete: ${key} will expire in ${ttlSeconds}s`);
};

export { setRedisItem, setRedisItemWithTTL, setRedisTTL, getRedisItem, deleteRedisItem, softDeleteRedisItem, setMemoryCache, getMemoryCache };
