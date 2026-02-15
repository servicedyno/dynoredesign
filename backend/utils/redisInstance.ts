import { createClient } from "redis";
import { cronLogger } from "../utils/loggers";
import { log } from "./loggers";

const redisClient = createClient({
  url: process.env.REDIS_PUBLIC_URL,
  socket: {
    connectTimeout: 5000,
    reconnectStrategy: retries => Math.min(retries * 100, 3000),
  },
});

redisClient.on("error", err => {
  // Suppress noisy repeated ECONNRESET logs — only log once per 60s
  const now = Date.now();
  const msg = err.message || '';
  if (msg.includes('ECONNRESET') || msg.includes('Connection timeout') || msg.includes('Socket closed')) {
    if (now - lastRedisErrorLog < 60000) return; // throttle: 1 log per minute
    lastRedisErrorLog = now;
    log(`Redis connection issue (throttled): ${msg}`, "error");
  } else {
    log(`Redis Client Error: ${msg}`, "error");
  }
});

let lastRedisErrorLog = 0;

redisClient.on("reconnecting", () => {
  redisConnected = false;
  log("Redis reconnecting...", "info");
});

redisClient.on("ready", () => {
  redisConnected = true;
  log("Redis connection ready", "info");
});

let redisConnected = false;

export const connectRedis = async () => {
  if (!redisConnected) {
    await redisClient.connect();
    redisConnected = true;
    log("Redis connected", "info");
  }
};

// ============================================
// REDIS CACHE OPERATIONS (Single unified cache)
// ============================================

const setRedisItem = async (key: string, value: unknown) => {
  // Store as JSON string for all objects (simplified storage)
  if (typeof value === 'object' && value !== null) {
    await redisClient.set(key + ':json', JSON.stringify(value));
    // Also delete any old hash data to prevent stale reads
    await redisClient.del(key);
  } else {
    for (const [field, val] of Object.entries(value as Record<string, unknown>)) {
      if (val !== undefined && val !== null) {
        await redisClient.hSet(key, field, String(val));
      }
    }
  }
};

// Set Redis item with TTL (time-to-live in seconds)
const setRedisItemWithTTL = async (key: string, value: unknown, ttlSeconds: number) => {
  if (typeof value === 'object' && value !== null) {
    await redisClient.set(key + ':json', JSON.stringify(value), { EX: ttlSeconds });
  } else {
    for (const [field, val] of Object.entries(value as Record<string, unknown>)) {
      if (val !== undefined && val !== null) {
        await redisClient.hSet(key, field, String(val));
      }
    }
    await redisClient.expire(key, ttlSeconds);
  }
};

// Set TTL on existing key
const setRedisTTL = async (key: string, ttlSeconds: number) => {
  await redisClient.expire(key, ttlSeconds);
  await redisClient.expire(key + ':json', ttlSeconds);
};

const getRedisItem = async (key: string) => {
  // Check for JSON stored object FIRST (preferred storage for objects)
  const jsonValue = await redisClient.get(key + ':json');
  if (jsonValue) {
    try {
      return JSON.parse(jsonValue);
    } catch (e) {
      cronLogger.info(`[Redis] JSON parse error for ${key}:json, falling back to hash`);
    }
  }
  
  // Fall back to hash storage (only if JSON doesn't exist)
  const hashValue = await redisClient.hGetAll(key);
  if (hashValue && Object.keys(hashValue).length > 0) {
    return hashValue;
  }
  
  // No data found
  return {};
};

const deleteRedisItem = async (key: string) => {
  await redisClient.del(key);
  await redisClient.del(key + ':json');
};

// Soft delete - set TTL instead of immediate deletion (for checkout polling)
const softDeleteRedisItem = async (key: string, ttlSeconds: number = 1800) => {
  // Default 30 minutes TTL to allow checkout to poll for status
  await redisClient.expire(key, ttlSeconds);
  await redisClient.expire(key + ':json', ttlSeconds);
  cronLogger.info(`[Redis] Soft delete: ${key} will expire in ${ttlSeconds}s`);
};

// ============================================
// BACKWARD COMPATIBILITY (deprecated functions)
// ============================================
// These are kept for backward compatibility but now just use Redis

const setMemoryCache = (key: string, value: unknown, ttlSeconds: number) => {
  // Now just calls setRedisItemWithTTL
  setRedisItemWithTTL(key, value, ttlSeconds);
};

const getMemoryCache = async (key: string): Promise<unknown | null> => {
  // Now just calls getRedisItem
  const result = await getRedisItem(key);
  return Object.keys(result).length > 0 ? result : null;
};

const invalidateCache = async (key: string) => {
  await deleteRedisItem(key);
  cronLogger.info(`[Redis] INVALIDATED ${key}`);
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
    try {
      // SET NX (only if not exists) with EX (expiry)
      const result = await redisClient.set(fullKey, lockValue, {
        NX: true,
        EX: ttlSeconds
      });
      
      if (result === 'OK') {
        // Store lockValue so releaseLock can verify ownership
        lockOwners.set(fullKey, lockValue);
        cronLogger.info(`[Lock] Acquired: ${lockKey}`);
        return true;
      }
      
      // Log who holds the lock for debugging
      if (attempt === 0) {
        const holder = await redisClient.get(fullKey);
        const ttl = await redisClient.ttl(fullKey);
        cronLogger.info(`[Lock] ${lockKey} held by ${holder}, TTL: ${ttl}s (current PID: ${process.pid})`);
      }
    } catch (err) {
      cronLogger.error(`[Lock] Redis error during acquire ${lockKey}: ${err instanceof Error ? err.message : String(err)}`);
    }
    
    // Wait before retry
    if (attempt < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    }
  }
  
  cronLogger.info(`[Lock] Failed to acquire after ${maxRetries} attempts: ${lockKey}`);
  return false;
};

// Track lock ownership per key for safe release
const lockOwners = new Map<string, string>();

// Lua script for atomic compare-and-delete (only delete if we own the lock)
const RELEASE_LOCK_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

/**
 * Release a distributed lock (only if current process owns it)
 * Uses atomic Lua script to prevent releasing another process's lock
 * @param lockKey - Unique key for the lock
 */
const releaseLock = async (lockKey: string): Promise<void> => {
  const fullKey = `lock:${lockKey}`;
  const lockValue = lockOwners.get(fullKey);
  
  if (lockValue) {
    try {
      const result = await redisClient.eval(RELEASE_LOCK_SCRIPT, {
        keys: [fullKey],
        arguments: [lockValue],
      });
      if (result === 1) {
        cronLogger.info(`[Lock] Released: ${lockKey}`);
      } else {
        cronLogger.warn(`[Lock] Lock expired or owned by another process: ${lockKey}`);
      }
    } catch (err) {
      // Fallback: delete directly if Lua eval fails (e.g., older Redis)
      await redisClient.del(fullKey);
      cronLogger.info(`[Lock] Released (fallback): ${lockKey}`);
    }
    lockOwners.delete(fullKey);
  } else {
    // No ownership info — legacy fallback
    await redisClient.del(fullKey);
    cronLogger.info(`[Lock] Released (no owner): ${lockKey}`);
  }
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
  redisClient as redis,
};
